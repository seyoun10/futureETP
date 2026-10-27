// expo-sqlite kv-store는 네이티브 모듈이라 Jest에서는 메모리 Map으로 바꾼다(표시 설정 persist, D-030).
jest.mock('expo-sqlite/kv-store', () => {
  const items = new Map<string, string>();
  return {
    Storage: {
      getItemSync: (key: string) => items.get(key) ?? null,
      setItemSync: (key: string, value: string) => {
        items.set(key, value);
      },
      removeItemSync: (key: string) => items.delete(key),
      clearSync: () => {
        items.clear();
        return true;
      },
    },
  };
});
