declare module 'react-virtualized-auto-sizer' {
  import * as React from 'react';

  interface Size {
    width: number;
    height: number;
  }

  interface AutoSizerProps {
    children: (size: Size) => React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onResize?: (size: Size) => void;
    disableHeight?: boolean;
    disableWidth?: boolean;
  }

  const AutoSizer: React.FC<AutoSizerProps>;

  export default AutoSizer;
}
