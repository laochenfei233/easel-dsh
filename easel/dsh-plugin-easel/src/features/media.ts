// EASEL-DIVERGENCE(easel-view-split): the sidebar media previewer, mounted as
// its own client plugin. Registration is guarded: a media failure degrades to
// the host's "unsupported + open" state and never affects the page views.
import { registerMediaPreview } from '../lib/media-preview'

export const plugin = {
  name: 'easel-media',
  inject: ['slots', 'locale'],
  apply(ctx: any) {
    try {
      registerMediaPreview(ctx)
    } catch (error) {
      console.warn('easel-media: registration failed', error)
    }
  },
}
