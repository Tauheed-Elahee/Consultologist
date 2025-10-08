declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.liquid' {
  const content: string;
  export default content;
}
