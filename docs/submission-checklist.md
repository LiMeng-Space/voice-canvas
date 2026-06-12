# 作品提交检查清单

## 关键时间

- 开始时间：2026-06-12 00:00
- 截止时间：2026-06-14 23:59
- 所有 commit 时间戳必须落在这个区间内。
- 不要在最后一天一次性导入全部代码，应保持多个 PR 和持续 commit。

## 第一步：创建远程仓库

在 GitHub 或 Gitee 创建一个全新的公开仓库。仓库创建时间应晚于议题发布时间。

建议仓库名：

```text
voice-canvas
```

## 第二步：配置本地 Git 身份

请替换成你自己的姓名和邮箱：

```bash
git config user.name "你的名字"
git config user.email "你的邮箱"
```

## 第三步：提交初始化版本

```bash
git add .
git commit -m "chore: initialize voice canvas app"
```

## 第四步：关联远程仓库

把 URL 替换成你的 GitHub 或 Gitee 仓库地址：

```bash
git remote add origin https://github.com/你的用户名/voice-canvas.git
git push -u origin main
```

## 第五步：按 PR 拆分后续迭代

每个 PR 只做一件事，建议按 `docs/pr-plan.md` 拆分。

创建功能分支示例：

```bash
git checkout -b feature/speech-recognition
```

提交并推送：

```bash
git add .
git commit -m "feat: add speech recognition workflow"
git push -u origin feature/speech-recognition
```

然后在 GitHub 或 Gitee 页面创建 PR，PR 描述必须包含：

- 功能描述
- 实现思路
- 测试方式

## 第六步：录制并上传 Demo

按 `docs/demo-script.md` 录制视频，上传到 bilibili、云盘或其他可访问平台，然后把链接填入 README。

## 第七步：最终自查

- README 有运行方式、依赖说明、Demo 链接。
- `DESIGN_DOC.md` 说明了计划支持、已实现、未完成及原因。
- 仓库能公开访问。
- 主分支代码可运行。
- PR 描述不为空，且与实际代码变更一致。
- 没有引用未声明的第三方库。
- 没有提交旧代码而不说明来源。
