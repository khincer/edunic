import os, re, glob

routes_dir = 'apps/edunic-api/src/routes'
for path in glob.glob(os.path.join(routes_dir, '*.ts')):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    orig = c
    # Replace any remaining admin in authorizeRoles arrays
    c = re.sub(r"\[\s*'admin'\s*\]", "['director', 'vice_director', 'subdirector']", c)
    c = re.sub(r"\[\s*'admin'\s*,\s*'teacher'\s*\]", "['director', 'vice_director', 'subdirector', 'teacher']", c)
    c = re.sub(r"\[\s*'admin'\s*,\s*'teacher'\s*,\s*'parent'\s*\]", "['director', 'vice_director', 'subdirector', 'teacher', 'parent']", c)
    c = re.sub(r"\[\s*'admin'\s*,\s*'parent'\s*\]", "['director', 'vice_director', 'subdirector', 'parent']", c)
    if c != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print(path)
print('done')
