Cloudflare R2 public access and custom domain notes

1. R2 objects are private by default.
2. To make a custom domain like `cdn.hiddenlinux.com` work, you can use:
   - Cloudflare R2 Public Bucket access (for simple public object hosting), or
   - Cloudflare Stream/Images/Workers for more custom behavior.
3. For your current use case, the easiest path is:
   - create a public R2 bucket or a public bucket access policy for the object,
   - then create a custom domain in Cloudflare for the bucket via R2 Public Access / custom domain support.

For your PDF preview and checkout flow, the Worker/API endpoint is the safer route for now.
