import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { webAuthStorage } from "./web-auth-storage";

const REFRESH_TOKEN_KEY = "ridepilot.refresh-token";

export const authStorage = {
  async getRefreshToken(): Promise<string | null> {
    return Platform.OS === "web"
      ? webAuthStorage.getRefreshToken()
      : SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setRefreshToken(token: string): Promise<void> {
    if (Platform.OS === "web") {
      webAuthStorage.setRefreshToken(token);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },
  async clearRefreshToken(): Promise<void> {
    if (Platform.OS === "web") {
      webAuthStorage.clearRefreshToken();
      return;
    }
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
