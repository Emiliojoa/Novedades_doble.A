import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
export function useApi(path) {
  const [state, setState] = useState({
    data: null,
    error: "",
    path: null,
    version: -1,
  });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let current = true;
    api(path)
      .then((data) => {
        if (current) setState({ data, error: "", path, version });
      })
      .catch((e) => {
        if (current) setState({ data: null, error: e.message, path, version });
      });
    return () => {
      current = false;
    };
  }, [path, version]);
  const loading = state.path !== path || state.version !== version;
  return {
    data: loading ? null : state.data,
    error: loading ? "" : state.error,
    loading,
    refresh,
  };
}
