# RidePilot 项目目录

当前目录中的 `RidePilot_Product` 和 `RidePilot_UI` 是指向同级 Git 仓库的符号链接。直接打开 `RidePilot/`，就能在项目文件树中看到开发、产品与设计内容：

| 当前项目中的路径 | 仓库 | 用途 |
| --- | --- | --- |
| `./` | [RidePilot](https://github.com/hanshuai912/RidePilot.git) | 开发规范，以及后续应用代码 |
| `./RidePilot_Product/` | [RidePilot_Product](https://github.com/hanshuai912/RidePilot_Product.git) | 产品需求与产品规范 |
| `./RidePilot_UI/` | [RidePilot_UI](https://github.com/hanshuai912/RidePilot_UI.git) | 设计规范与 UI 稿 |

三个实际仓库目录应位于同一父目录下。若尚未克隆产品或 UI 仓库，在 `RidePilot/` 的父目录执行：

```bash
git clone https://github.com/hanshuai912/RidePilot_Product.git
git clone https://github.com/hanshuai912/RidePilot_UI.git
```

两个链接指向 `../RidePilot_Product` 和 `../RidePilot_UI`。各仓库仍独立提交和推送，产品及 UI 文件的改动不会出现在当前仓库的 `git status` 中。将来实现应用代码时，`RidePilot/` 内仍按 [`agents/development/Agent.md`](./agents/development/Agent.md) 使用 pnpm monorepo。
