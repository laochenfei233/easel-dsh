---
type: fixed
breaking: false
audience: user
commits: 7067bff
---
修复爆款拆解语音转写在只配置了 API Key 的模型（如内置的小米）上提示「未配置 Base URL」的问题：现在会回退到该模型路由的默认接口地址。
