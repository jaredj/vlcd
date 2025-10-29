declare module 'undici' {
  class ProxyAgent {
    constructor(proxy: string | URL | ProxyAgent.Options);
  }

  namespace ProxyAgent {
    interface Options {
      uri: string;
      [key: string]: unknown;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setGlobalDispatcher(dispatcher: any): void;

  export { ProxyAgent, setGlobalDispatcher };
}
