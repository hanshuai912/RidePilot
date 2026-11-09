# Android 开发包构建记录

日期：2026-11-09。

## 产物

- 根目录：`RidePilot-dev.apk`，244,986,906 字节（约 234 MiB）。
- 原始产物：`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`。
- 包名：`com.ridepilot.dev`；版本：`0.1.0`（versionCode 1）。
- Android API 24 起，目标 API 36；包含 `arm64-v8a`、`armeabi-v7a`、`x86`、`x86_64`。
- Android Debug 证书签名，可调试；APK 已被仓库既有忽略规则排除。
- SHA-256：`dd8b7c21d79b16ffc68e887f7eb7a343bb8dcdf6ccf02004e76d84387a45a969`。

## 实际构建与检查

在 `apps/mobile/android` 下，设置本机 JDK 17 的 `JAVA_HOME` 和 SDK 的 `ANDROID_HOME` 后执行：

```bash
./gradlew assembleDebug --no-daemon --max-workers=2 --console=plain
```

结果：`BUILD SUCCESSFUL in 6m 5s`，522 项任务中 199 项执行、323 项复用。
日志：`/tmp/ridepilot-dev-apk-build.log`。

本机生成目录中的 `gradle/gradle-daemon-jvm.properties` 原先指定 JDK 25。首次使用该 JDK 时，Prefab 的 JNA 原生访问警告导致 Worklets 配置任务失败。重试时临时移开这个本地配置，以 JDK 17 构建；退出时恢复原文件，随后 `cmp` 验证内容一致。未修改原生配置内容或业务代码。
Gradle 的 JVM criteria 优先于 `JAVA_HOME`，参见 [Gradle Daemon 文档](https://docs.gradle.org/9.3.1/userguide/gradle_daemon.html)。

根目录执行的检查：

- `pnpm --filter @ridepilot/mobile lint`：通过。
- `pnpm --filter @ridepilot/mobile typecheck`：通过。
- `cp apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk RidePilot-dev.apk`：复制本次新生成产物。
- `sha256sum apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk RidePilot-dev.apk`：两个文件哈希一致。
- SDK Build Tools 36.0.0 的 `apksigner verify --verbose --print-certs RidePilot-dev.apk`：通过，APK v2 签名有效。
- 同版本 `aapt dump badging RidePilot-dev.apk`：包名、版本、可调试标记和四个架构符合预期。
- ZIP 内容检查：包含 Gesture Handler、Reanimated、Worklets 原生动态库。

## 安装与运行

构建无需连接手机。本次未安装或执行实机交互验收；拖拽排序仍需按 [手势验收说明](./workout-drag-sorting-2026-11-09.md) 在设备上检查。

这是依赖 Metro 提供 JavaScript 的 debug 包。安装到设备后，在仓库根目录启动开发服务：

```bash
pnpm --filter @ridepilot/mobile start
```

确保设备可连接开发机上的 Metro 和本地 API。API 地址及 USB 转发配置见 [README](../../README.md)。
