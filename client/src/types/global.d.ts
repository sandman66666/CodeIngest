declare global {
  interface Window {
    env: {
      REACT_APP_API_URL?: string;
    };
  }
}

export {};
