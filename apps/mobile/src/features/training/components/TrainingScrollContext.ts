import { createContext } from "react";
import type { ScrollView } from "react-native";
import type { AnimatedRef } from "react-native-reanimated";

export const TrainingScrollContext = createContext<
  AnimatedRef<ScrollView> | undefined
>(undefined);
