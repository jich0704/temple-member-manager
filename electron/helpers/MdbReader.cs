using System;
using System.Collections.Generic;
using System.Data.OleDb;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

class MdbReader
{
    const int DefaultMaxRows = 50000;

    static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        try
        {
            var options = ParseArgs(args);
            var command = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            if (command != "test" && command != "sync")
            {
                WriteJson(new Dictionary<string, object> {
                    { "ok", false },
                    { "error", "Usage: MdbReader.exe test|sync --path=... --password=... --keyword=... --since=... --afterReceiveMemberId=..." }
                });
                return 1;
            }

            var path = GetOption(options, "path");
            var password = GetOption(options, "password");
            if (String.IsNullOrWhiteSpace(path))
            {
                WriteJson(new Dictionary<string, object> { { "ok", false }, { "error", "MDB path is required." } });
                return 1;
            }

            using (var connection = OpenConnection(path, password))
            {
                if (command == "test") Test(connection);
                else Sync(connection, options);
            }

            return 0;
        }
        catch (Exception ex)
        {
            WriteJson(new Dictionary<string, object> { { "ok", false }, { "error", ex.Message } });
            return 0;
        }
    }

    static Dictionary<string, string> ParseArgs(string[] args)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var arg in args.Skip(1))
        {
            if (!arg.StartsWith("--")) continue;
            var equalIndex = arg.IndexOf('=');
            if (equalIndex < 0) result[arg.Substring(2)] = "true";
            else result[arg.Substring(2, equalIndex - 2)] = arg.Substring(equalIndex + 1);
        }
        return result;
    }

    static string GetOption(Dictionary<string, string> options, string key, string defaultValue = "")
    {
        string value;
        return options.TryGetValue(key, out value) ? value : defaultValue;
    }

    static OleDbConnection OpenConnection(string path, string password)
    {
        var connectionString = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" + path + ";Jet OLEDB:Database Password=" + password + ";";
        var connection = new OleDbConnection(connectionString);
        connection.Open();
        return connection;
    }

    static void Test(OleDbConnection connection)
    {
        var tableCount = 0;
        using (var schema = connection.GetOleDbSchemaTable(OleDbSchemaGuid.Tables, null))
        {
            foreach (System.Data.DataRow row in schema.Rows)
            {
                if (String.Equals(Convert.ToString(row["TABLE_TYPE"]), "TABLE", StringComparison.OrdinalIgnoreCase)) tableCount++;
            }
        }

        var memberCount = ExecuteScalarInt(connection, "SELECT COUNT(*) FROM [Member]");
        WriteJson(new Dictionary<string, object> {
            { "ok", true },
            { "tableCount", tableCount },
            { "memberCount", memberCount },
            { "driver", "Microsoft.Jet.OLEDB.4.0 (x86 helper)" }
        });
    }

    static void Sync(OleDbConnection connection, Dictionary<string, string> options)
    {
        var keyword = GetOption(options, "keyword", "");
        var since = GetOption(options, "since");
        var afterReceiveMemberId = 0;
        var maxRows = DefaultMaxRows;
        int.TryParse(GetOption(options, "afterReceiveMemberId", "0"), out afterReceiveMemberId);
        int.TryParse(GetOption(options, "maxRows", DefaultMaxRows.ToString(CultureInfo.InvariantCulture)), out maxRows);

        var where = BuildWhereClause(keyword, since, afterReceiveMemberId);
        var countSql = "SELECT COUNT(*) FROM ((([ReceiveMember] rm LEFT JOIN [Receive] r ON rm.ReceiveID = r.ReceiveID) LEFT JOIN [Member] m ON rm.MemberID = m.MemberID) LEFT JOIN [FamilyInfo] fi ON r.FamilyInfoID = fi.FamilyInfoID) WHERE " + where;
        var total = ExecuteScalarInt(connection, countSql);

        if (total > maxRows)
        {
            WriteJson(new Dictionary<string, object> {
                { "ok", false },
                { "tooManyRows", true },
                { "total", total },
                { "maxRows", maxRows },
                { "keyword", keyword }
            });
            return;
        }

        var rows = ReadRows(connection, where);
        AttachPaymentMonths(connection, rows);

        WriteJson(new Dictionary<string, object> {
            { "ok", true },
            { "total", total },
            { "rows", rows },
            { "keyword", keyword },
            { "afterReceiveMemberId", afterReceiveMemberId },
            { "syncedAt", DateTime.Now.ToString("o") }
        });
    }

    static string BuildWhereClause(string keyword, string since, int afterReceiveMemberId)
    {
        var where = "1=1";
        if (!string.IsNullOrEmpty(keyword))
        {
            var safeKeyword = keyword.Replace("'", "''");
            where = "(r.Category LIKE '%" + safeKeyword + "%' OR r.ReceiveName LIKE '%" + safeKeyword + "%' OR r.SubCategory LIKE '%" + safeKeyword + "%' OR rm.LocCategory LIKE '%" + safeKeyword + "%' OR rm.LocLocation LIKE '%" + safeKeyword + "%')";
        }
        if (afterReceiveMemberId > 0)
        {
            where = "(" + where + ") AND rm.ReceiveMemberID > " + afterReceiveMemberId.ToString(CultureInfo.InvariantCulture);
        }
        if (!String.IsNullOrWhiteSpace(since))
        {
            var safeSince = since.Replace("'", "''");
            where = "(" + where + ") AND (rm.Updatedt >= #" + safeSince + "# OR rm.Createdt >= #" + safeSince + "# OR r.Updatedt >= #" + safeSince + "# OR r.Createdt >= #" + safeSince + "# OR m.UpdateDt >= #" + safeSince + "# OR m.CreateDt >= #" + safeSince + "# OR fi.UpdateDt >= #" + safeSince + "# OR fi.CreateDt >= #" + safeSince + "#)";
        }
        return where;
    }

    static List<Dictionary<string, object>> ReadRows(OleDbConnection connection, string where)
    {
        var sql = @"
SELECT
  rm.ReceiveMemberID,
  rm.ReceiveID,
  rm.MemberID,
  rm.LocID,
  rm.LocCategory,
  rm.LocLocation,
  rm.LocNum,
  rm.GrpNum,
  rm.RowIndex,
  rm.MemberName AS RmMemberName,
  rm.IsYoungga,
  rm.Ganji,
  rm.Relation,
  rm.Comment AS RmComment,
  rm.Createdt AS RmCreatedt,
  rm.Updatedt AS RmUpdatedt,
  r.ReceiveName,
  r.Category,
  r.SubCategory,
  r.Createdt AS ReceiveCreatedt,
  r.Updatedt AS ReceiveUpdatedt,
  r.Startdt,
  r.Enddt,
  r.Comment AS ReceiveComment,
  r.Deleted AS ReceiveDeleted,
  m.MemberNo,
  m.MemberNumber,
  m.MemberName,
  m.BuddhistName,
  m.Gender,
  m.BirthDate,
  m.BirthLunar,
  m.MobilePhone,
  m.IsSms,
  m.Deleted AS MemberDeleted,
  m.UpdateDt AS MemberUpdatedt,
  fi.FamilyNumber,
  fi.FamilyHolderName,
  fi.FamilyPhone,
  fi.FamilyAddrZip,
  fi.FamilyAddrCity,
  fi.FamilyAddrGu,
  fi.FamilyAddrDong,
  fi.FamilyAddrBunji
FROM ((( [ReceiveMember] rm
  LEFT JOIN [Receive] r ON rm.ReceiveID = r.ReceiveID)
  LEFT JOIN [Member] m ON rm.MemberID = m.MemberID)
  LEFT JOIN [FamilyInfo] fi ON r.FamilyInfoID = fi.FamilyInfoID)
WHERE " + where + @"
ORDER BY rm.ReceiveMemberID DESC";

        var rows = new List<Dictionary<string, object>>();
        using (var command = new OleDbCommand(sql, connection))
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                var receiveId = IntValue(reader, "ReceiveID");
                var locCategory = StringValue(reader, "LocCategory");
                var locLocation = StringValue(reader, "LocLocation");
                var receiveName = StringValue(reader, "ReceiveName");
                var category = StringValue(reader, "Category");
                var subCategory = StringValue(reader, "SubCategory");
                var locationName = FirstNonEmpty(locCategory, locLocation, receiveName, category, subCategory);
                var memberName = FirstNonEmpty(StringValue(reader, "MemberName"), StringValue(reader, "RmMemberName"));
                var familyHolder = FirstNonEmpty(StringValue(reader, "FamilyHolderName"), memberName);
                var phone = FirstNonEmpty(StringValue(reader, "MobilePhone"), StringValue(reader, "FamilyPhone"));
                var deleted = BoolValue(reader, "ReceiveDeleted") || BoolValue(reader, "MemberDeleted");
                var updatedAt = LatestDateIso(DateValue(reader, "RmUpdatedt"), DateValue(reader, "ReceiveUpdatedt"), DateValue(reader, "MemberUpdatedt"));

                var row = new Dictionary<string, object>();
                row["source"] = "mdb";
                row["mdbReceiveMemberId"] = IntValue(reader, "ReceiveMemberID");
                row["mdbReceiveId"] = receiveId;
                row["mdbMemberId"] = IntValue(reader, "MemberID");
                row["mdbLocId"] = IntValue(reader, "LocID");
                row["mdbUpdatedAt"] = updatedAt;
                row["mdbDeleted"] = deleted;
                row["name"] = memberName;
                row["phone"] = phone;
                row["status"] = "활동";
                row["인등번호"] = StringValue(reader, "LocNum") != "" && StringValue(reader, "LocNum") != "0" ? StringValue(reader, "LocNum") : StringValue(reader, "ReceiveMemberID");
                row["위치명"] = locationName;
                row["등록일"] = FirstNonEmpty(StringValue(reader, "Startdt"), DateLabel(DateValue(reader, "ReceiveCreatedt")));
                row["신도번호"] = FirstNonEmpty(StringValue(reader, "MemberNumber"), NonZero(StringValue(reader, "MemberNo")), StringValue(reader, "MemberID"));
                row["대주"] = familyHolder;
                row["영가여부"] = BoolLabel(BoolValue(reader, "IsYoungga"));
                row["동참자"] = memberName;
                row["법명"] = StringValue(reader, "BuddhistName");
                row["성별"] = StringValue(reader, "Gender");
                row["접수비고"] = FirstNonEmpty(StringValue(reader, "RmComment"), StringValue(reader, "ReceiveComment"));
                row["간지"] = StringValue(reader, "Ganji");
                row["음력"] = BoolLabel(BoolValue(reader, "BirthLunar"));
                row["생일"] = StringValue(reader, "BirthDate");
                row["휴대폰"] = phone;
                row["DM"] = SmsLabel(BoolValue(reader, "IsSms"));
                row["우편번호"] = StringValue(reader, "FamilyAddrZip");
                row["주소"] = AddressLabel(StringValue(reader, "FamilyAddrCity"), StringValue(reader, "FamilyAddrGu"), StringValue(reader, "FamilyAddrDong"), StringValue(reader, "FamilyAddrBunji"));
                row["주소(동)"] = StringValue(reader, "FamilyAddrDong");
                row["주소(번지)"] = StringValue(reader, "FamilyAddrBunji");
                row["가족순서"] = FirstNonEmpty(StringValue(reader, "RowIndex"), StringValue(reader, "GrpNum"));
                row["최종납부월"] = "";
                row["접수명"] = receiveName;
                row["분류"] = category;
                row["세부분류"] = subCategory;
                rows.Add(row);
            }
        }
        return rows;
    }

    static void AttachPaymentMonths(OleDbConnection connection, List<Dictionary<string, object>> rows)
    {
        var receiveIds = rows.Select(r => Convert.ToInt32(r["mdbReceiveId"])).Where(id => id > 0).Distinct().ToList();
        var paymentByReceiveId = new Dictionary<int, string>();

        for (var offset = 0; offset < receiveIds.Count; offset += 500)
        {
            var chunk = receiveIds.Skip(offset).Take(500).ToList();
            if (chunk.Count == 0) continue;

            var sql = "SELECT ReceiveID, MAX(ReceiveYr * 100 + ReceiveMon) AS LastYm FROM [ReceiveCollectMonth] WHERE ReceiveID IN (" + String.Join(",", chunk) + ") GROUP BY ReceiveID";
            using (var command = new OleDbCommand(sql, connection))
            using (var reader = command.ExecuteReader())
            {
                while (reader.Read())
                {
                    paymentByReceiveId[IntValue(reader, "ReceiveID")] = MonthLabel(IntValue(reader, "LastYm"));
                }
            }
        }

        foreach (var row in rows)
        {
            var receiveId = Convert.ToInt32(row["mdbReceiveId"]);
            string lastMonth;
            if (paymentByReceiveId.TryGetValue(receiveId, out lastMonth)) row["최종납부월"] = lastMonth;
        }
    }

    static int ExecuteScalarInt(OleDbConnection connection, string sql)
    {
        using (var command = new OleDbCommand(sql, connection))
        {
            var value = command.ExecuteScalar();
            return value == null || value == DBNull.Value ? 0 : Convert.ToInt32(value);
        }
    }

    static string StringValue(System.Data.IDataRecord reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        if (reader.IsDBNull(ordinal)) return "";
        return Convert.ToString(reader.GetValue(ordinal));
    }

    static int IntValue(System.Data.IDataRecord reader, string name)
    {
        var value = StringValue(reader, name);
        int result;
        return Int32.TryParse(value, out result) ? result : 0;
    }

    static bool BoolValue(System.Data.IDataRecord reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        if (reader.IsDBNull(ordinal)) return false;
        var value = reader.GetValue(ordinal);
        if (value is bool) return (bool)value;
        var text = Convert.ToString(value);
        return text == "1" || text == "-1" || text.Equals("True", StringComparison.OrdinalIgnoreCase);
    }

    static DateTime? DateValue(System.Data.IDataRecord reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        if (reader.IsDBNull(ordinal)) return null;
        var value = reader.GetValue(ordinal);
        if (value is DateTime) return (DateTime)value;
        DateTime parsed;
        return DateTime.TryParse(Convert.ToString(value), out parsed) ? (DateTime?)parsed : null;
    }

    static string LatestDateIso(params DateTime?[] dates)
    {
        var latest = dates.Where(d => d.HasValue).Select(d => d.Value).OrderByDescending(d => d).FirstOrDefault();
        return latest == default(DateTime) ? "" : latest.ToString("o");
    }

    static string DateLabel(DateTime? value)
    {
        return value.HasValue ? value.Value.ToString("yyyy-MM-dd") : "";
    }

    static string MonthLabel(int value)
    {
        if (value <= 0) return "";
        return String.Format(CultureInfo.InvariantCulture, "{0:0000}-{1:00}", value / 100, value % 100);
    }

    static string BoolLabel(bool value)
    {
        return value ? "O" : "X";
    }

    static string SmsLabel(bool value)
    {
        return value ? "수신동의" : "미동의";
    }

    static string AddressLabel(params string[] parts)
    {
        return String.Join(" ", parts.Where(p => !String.IsNullOrWhiteSpace(p)));
    }

    static string FirstNonEmpty(params string[] values)
    {
        return values.FirstOrDefault(v => !String.IsNullOrWhiteSpace(v)) ?? "";
    }

    static string NonZero(string value)
    {
        return value == "0" ? "" : value;
    }

    static void WriteJson(object value)
    {
        var serializer = new JavaScriptSerializer { MaxJsonLength = Int32.MaxValue };
        Console.WriteLine(serializer.Serialize(value));
    }
}
