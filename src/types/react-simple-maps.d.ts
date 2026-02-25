declare module "react-simple-maps" {
  import type { ComponentType, SVGProps, ReactNode, CSSProperties } from "react";

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  interface GeographiesChildrenArgs {
    geographies: Geography[];
  }

  interface Geography {
    rsmKey: string;
    properties: Record<string, unknown>;
    type: string;
    geometry: unknown;
  }

  interface GeoStyleState {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
    cursor?: string;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (args: GeographiesChildrenArgs) => ReactNode;
  }

  interface GeographyProps {
    geography: Geography;
    onClick?: () => void;
    style?: {
      default?: GeoStyleState;
      hover?: GeoStyleState;
      pressed?: GeoStyleState;
    };
  }

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    children?: ReactNode;
  }

  interface MarkerProps {
    coordinates: [number, number];
    onClick?: () => void;
    style?: CSSProperties;
    children?: ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
  export const Marker: ComponentType<MarkerProps>;
  export const Annotation: ComponentType<unknown>;
  export const Graticule: ComponentType<unknown>;
  export const Line: ComponentType<unknown>;
  export const Sphere: ComponentType<unknown>;
}
