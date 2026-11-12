Place the original AMÉZA MP4 here as `ameza-brand.mp4` before deploying.
Encode for broad mobile compatibility with H.264 video, AAC audio, and MP4
fast-start (moov atom before media data). The storefront uses this file when
no admin video is selected or an uploaded video cannot load.

Runtime admin uploads go directly to Supabase Storage, never this directory.
