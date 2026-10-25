---
kind: upgrade-guide
description: "The ui-settings-account plugin drops the contactFormUrl and contactSource configuration keys together with the sidebar Feedback entry."
---

# Remove the account contact questionnaire configuration

English | [中文](guide.zh.md)

## Change

The `@deepseek-ai/dsh-client-ui-settings-account` plugin no longer offers the `contactFormUrl` and `contactSource` cordis.yml keys, and the sidebar account menu no longer opens the external Feishu questionnaire: its Feedback entry is gone, together with the Sign in entry and the signed-out More menu. Before sign-in the sidebar launcher is the plain Settings trigger, and feedback lives on the About settings page as a link to the product repository's issue tracker. Deployments that set either key on the plugin are affected.

## Migration

1. Remove `contactFormUrl` and `contactSource` from the `ui-settings-account` entry in `cordis.yml` or its overlays:

   ```yaml
   - id: ui-settings-account
     config:
       contactFormUrl: https://example.test/form/   # delete
       contactSource: harness                       # delete
   ```

2. Point users who relied on the questionnaire at the repository issue tracker that the About page's Feedback link opens. Confirm the plugin still boots and that Settings → About shows the Feedback link.
