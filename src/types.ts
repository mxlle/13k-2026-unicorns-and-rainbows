export type ComponentDefinition<UpdateOptions = unknown, R = void> = [
  hostElement: HTMLElement,
  updateFunction?: (options?: UpdateOptions) => R,
];
