// jest.setup.ts — mocks de módulos nativos para correr pantallas y hooks sin
// dispositivo (TS-10). Todo lo que toque cámara, TTS, háptica o storage se
// reemplaza por stubs.
import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 400, height: 800 }),
  };
});

jest.mock("expo-secure-store", () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (k: string) => store[k] ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      delete store[k];
    }),
  };
});

jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("expo-keep-awake", () => ({ useKeepAwake: jest.fn() }));
jest.mock("expo-file-system", () => {
  class Directory {
    uri = "file:///mock/";
    create() {}
    list() {
      return [];
    }
  }
  class File {
    uri = "file:///mock/file.json";
    write = jest.fn();
  }
  return { Directory, File, Paths: { document: new Directory(), cache: new Directory() } };
});
jest.mock("expo-splash-screen", () => ({ preventAutoHideAsync: jest.fn(async () => {}), hideAsync: jest.fn(async () => {}) }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: jest.fn(async () => {}) }));
jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { LinearGradient: ({ children, style }: any) => React.createElement(View, { style }, children) };
});
jest.mock("expo-av", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Video: React.forwardRef((props: any, _ref: any) => React.createElement(View, { testID: "video" })),
    ResizeMode: { COVER: "cover", CONTAIN: "contain" },
  };
});
jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = (props: any) => React.createElement(View, props, props.children);
  return { __esModule: true, default: Mock, Svg: Mock, Circle: Mock, Line: Mock, SvgXml: Mock };
});
jest.mock("react-native-vision-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Camera: (props: any) => React.createElement(View, { testID: "camera" }),
    useCameraDevice: () => ({ id: "front" }),
    useCameraFormat: () => undefined,
    useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
    useFrameProcessor: (fn: any) => fn,
    VisionCameraProxy: { initFrameProcessorPlugin: () => ({ call: () => [] }) },
  };
});
jest.mock("react-native-worklets-core", () => ({
  Worklets: { createRunOnJS: (fn: any) => fn },
  useSharedValue: (v: any) => ({ value: v }),
}));
jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: (props: any) => React.createElement(View, { testID: "datetimepicker" }) };
});

// expo-router: navegación observable desde los tests.
export const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => (global as any).__routeParams ?? {},
    useSegments: () => [],
    usePathname: () => "/",
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), [cb]);
    },
    Stack: ({ children }: any) => children ?? null,
    Tabs: Object.assign(({ children }: any) => children ?? null, { Screen: () => null }),
    Link: ({ children }: any) => children ?? null,
  };
});

(global as any).__DEV__ = true;
