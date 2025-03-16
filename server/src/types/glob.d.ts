declare module 'glob' {
  function sync(pattern: string, options?: any): string[];
  export = sync;
}
