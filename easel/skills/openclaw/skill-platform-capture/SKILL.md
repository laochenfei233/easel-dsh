---
name: skill-platform-capture
description: >-
  用裸 CDP 驱动已登录的反检测浏览器，实抓平台公开数据：账号主页精确粉丝与笔记指标、按关键词搜索出的对标账号池、账号矩阵盘点，产出可核实的量化对比与可视化底稿。
  当用户说"实抓平台数据""抓一下真实粉丝数""拉对标账号数据""盘点账号矩阵""精确指标"，或 web_fetch 被登录墙与反爬挡住、需要平台侧真实数字时使用。
  与 skill-competitor-analysis 的边界：本 SKILL 只负责拿到平台真实数据，对标结论与差异化建议交给它。
layer: general
---

# 平台数据实抓（CDP）

> 驱动一台已登录的反检测浏览器，用 Chrome DevTools Protocol 读平台**真实**数据，产出可核实的指标。只读，不发布、不互动。

## 输入

- **必需**：目标平台（`xhs` / `douyin`）、目标账号（主页 URL 或 userId）
- **可选**：对比关键词列表（用于扫出对标账号池）、已有 Profile 名、输出路径

## 输出

统一 JSON 契约（写盘走仓库产物契约，系统写入落在已注册的 `_probe/`）：

```json
{
  "account": "平台账号标识",
  "nickname": "昵称", "red_id": "平台号", "ip_location": "属地",
  "tags": ["标签"],
  "metrics": {
    "follows": "关注", "fans": "粉丝", "engagement": "获赞与收藏",
    "notes": 492, "liked": 5806, "collected": 2110,
    "avg_likes_per_note": 11.8
  },
  "notes": [{"title": "标题", "type": "normal|video", "likes": "43", "sticky": false}]
}
```

`by_author`（sweep 输出）按 `hits`（命中关键词数）与 `max_likes` 降序：

```json
{"author": "账号名", "userId": "...", "hits": 6, "max_likes": 43, "keywords": ["社群"], "samples": ["43 | 标题"]}
```

## 执行步骤

1. **确认 CDP 通道与登录态。** 先跑 `check`，确认端口可达且目标平台 `logged_in` 为真。
   未登录不要继续 —— 未登录视图只给「1千+」这类概数，登录态才有精确值。

   ```bash
   python skills/openclaw/skill-platform-capture/scripts/platform_capture.py check
   ```

2. **抓本人/目标账号画像。** 传入主页 URL 或平台 userId。

   ```bash
   python skills/openclaw/skill-platform-capture/scripts/platform_capture.py profile --platform xhs --account 60de590e0000000001008454
   ```

   小红书裸主页链接会被跳登录页；有 `xsec_token` 的分享链可直接传 `--account`。

3. **扫对标账号池。** 先用赛道基础词建池，再用垂类词测纵深。多关键词之间脚本会自行停顿节流（平台风控节流的是「读」）。

   ```bash
   python skills/openclaw/skill-platform-capture/scripts/platform_capture.py search --platform xhs --keyword "宁波同城活动"
   python skills/openclaw/skill-platform-capture/scripts/platform_capture.py sweep --platform xhs --keywords "宁波社群,宁波搭子,宁波活动排期"
   ```

4. **对候选账号逐个抓主页**（第 2 步），补齐粉丝/笔记/获赞，算 `avg_likes_per_note`。

5. **拉全量笔记清单。** 主页首屏只加载约 30 张卡片，`notes` 会滚动到底把全量采集下来
   （标题 / noteId / 点赞）。做活动盘点、选题分布、内容形态归类都靠它。

   ```bash
   python skills/openclaw/skill-platform-capture/scripts/platform_capture.py notes --account 60de590e0000000001008454
   ```

6. **读指定笔记正文。** 用于提取活动清单、报名信息、正文结构等只存在于详情页的内容。
   **不要直接用 `/explore/<noteId>`** —— 无 token 必然 404；`note` 会先从主页采集 token。

   ```bash
   python skills/openclaw/skill-platform-capture/scripts/platform_capture.py note --account 60de590e0000000001008454 --note-ids 6a81b142000000002c0070fc
   ```

7. **量化对比与可视化。** 指标定义、量级落差下的刻度选择、三种交付物（大屏 / 手机 PDF / 长图）的导出规范见 [benchmark-metrics.md](references/benchmark-metrics.md)。

8. **矩阵盘点。** 从目标账号的置顶笔记正文提取自述的矩阵结构（分站、主理人、子品牌），再逐个 `search` 验证哪些是真账号、哪些只是品牌标签 —— **自述与实存经常不一致**。

客户端协议、各平台踩坑与降级路径见 [platform-cdp-notes.md](references/platform-cdp-notes.md)。

## 降级与诚实标注

- **拿不到就不写。** 创作者中心后台数据（播放/完播/粉丝增量）不在此通道范围，标注「无公开数据」，不编造。
- **登录态缺失** → `check` 报 `logged_in: false`，先解决登录再抓，不要用概数替代精确值。
- **页面结构改版** → SSR/DOM 解析失败，抛错并附原始证据，不返回半截数据。
- **被风控** → 拉长关键词间隔、降低单次关键词数；不要把读操作并发或零延迟连发。

## Profile 感知

- **有 Profile 时**：把抓到的指标与 `platforms.md` 既有记录对账 —— 差异要显式指出（粉丝量级、笔记数、矩阵账号是否已登记）；把新发现的矩阵账号与平台约束回填 `platforms.md`，把形态×互动结论回填 `memory.md`。
- **无 Profile 时**：只产出结构化 JSON 与对比表，不写入任何 Profile 目录；提示用户「回填需要画像名」。

## 自检

```bash
python skills/openclaw/skill-platform-capture/scripts/platform_capture.py selftest
```
