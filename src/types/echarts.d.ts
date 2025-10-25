declare module 'echarts' {
  export type EChartsOption = Record<string, unknown>;

  export interface DefaultLabelFormatterCallbackParams {
    axisValue?: string | number;
    name?: string;
    marker?: string | { content?: string };
    value?: number | number[];
    seriesName?: string;
  }

  export type TooltipComponentFormatterCallbackParams =
    | DefaultLabelFormatterCallbackParams
    | DefaultLabelFormatterCallbackParams[];

  export interface TooltipComponentOption {
    formatter?: (params: TooltipComponentFormatterCallbackParams) => string;
  }
}

declare module 'echarts-for-react' {
  import type { CSSProperties, ComponentType } from 'react';
  import type { EChartsOption } from 'echarts';

  export interface ReactEChartsProps {
    option: EChartsOption;
    notMerge?: boolean;
    lazyUpdate?: boolean;
    style?: CSSProperties;
    theme?: string;
  }

  const ReactECharts: ComponentType<ReactEChartsProps>;
  export default ReactECharts;
}
