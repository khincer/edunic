import os, re, glob

# Fix API routes
for p in glob.glob('apps/edunic-api/src/routes/*.ts'):
    with open(p, encoding='utf-8') as f:
        c = f.read()
    orig = c
    # Replace institutionId from request.user
    c = re.sub(r"request\.user\?\.institutionId\s*\?\?\s*''", "''", c)
    c = re.sub(r"request\.user\.institutionId", "(request.user as any)?.institutionId || ''", c)
    if c != orig:
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(p)
print('done')
