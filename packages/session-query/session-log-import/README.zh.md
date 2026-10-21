---
description: "宿主侧导入导出的会话 ZIP：把会话物化进本地持久化、把工作目录重映射到本机，并恢复引用的附件。"
kind: "package-library"
---

# @deepseek-ai/dsh-session-log-import

[English](README.md) | 中文

## 概述

本包是 `@deepseek-ai/dsh-session-log-export` 的导入对应面：读取一个导出的会话 ZIP（规范 JSONL 日志加内容寻址的图片与文件），把其中每个会话写入挂载的持久化仓库，并把会话头里记录的工作目录替换为导入设备的项目路径。子代理谱系以 seeded 子会话随包携带，其 fork 继承切口由种子标记事件还原。任一日志损坏或任一会话 id 在本地已存在时，导入在第一次写入前就拒绝；附件经挂载仓库的公开写 API 入库，并校验其重新物化的 id 与日志记录一致。

## 目录

- [使用本包](#use_this_package)

<a id="use_this_package"></a>
## 使用本包

把本包作为插件挂载，然后调用 `ctx.sessionLogImporter.importArchive(zipBytes, { targetCwd })`，`targetCwd` 取本机绝对路径。调用返回已存储的根会话及其子会话。`targetCwd` 必填：导入会话的工具必须操作本机这份项目副本，因此会话头的 `cwd` 会被改写而不是保留。日志本身没有记录工作目录的会话保持无 cwd。会话 id 冲突、格式版本不受支持、或附件重新物化出的 id 与记录不一致，都会以类型化错误显式失败；不会静默改名，也不会产生半链接状态。
