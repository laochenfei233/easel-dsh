---
kind: upgrade-guide
description: "ui-settings-account 插件移除 contactFormUrl 与 contactSource 配置键，侧边栏意见反馈入口一并退役。"
---

# 移除账号问卷反馈配置

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-client-ui-settings-account` 插件不再提供 `contactFormUrl` 与 `contactSource` 这两个 cordis.yml 键，侧边栏账号菜单也不再打开外部飞书问卷：意见反馈入口与登录入口、未登录的「更多」菜单一并移除。登录前侧边栏是普通的设置按钮，意见反馈位于通用设置分区，链接到产品仓库的 issue 列表。在插件上设置过这两个键的部署受影响。

## 迁移

1. 从 `cordis.yml` 及其 overlay 的 `ui-settings-account` 条目中删除这两个键：

   ```yaml
   - id: ui-settings-account
     config:
       contactFormUrl: https://example.test/form/   # 删除
       contactSource: harness                       # 删除
   ```

2. 将依赖问卷反馈的用户引向通用设置底部新的意见反馈行所打开的仓库 issue 列表。确认插件正常启动，且 设置 → 通用 最下方显示意见反馈行。
