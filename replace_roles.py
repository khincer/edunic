import os, re, glob

routes_dir = 'apps/edunic-api/src/routes'
for path in glob.glob(os.path.join(routes_dir, '*.ts')):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    c2 = c
    c2 = re.sub(r"authorizeRoles\(\[\s*'admin'\s*\]\)", "authorizeRoles(['director', 'vice_director', 'subdirector'])", c2)
    c2 = re.sub(r"authorizeRoles\(\[\s*'admin'\s*,\s*'teacher'\s*\]\)", "authorizeRoles(['director', 'vice_director', 'subdirector', 'teacher'])", c2)
    c2 = re.sub(r"authorizeRoles\(\[\s*'admin'\s*,\s*'teacher'\s*,\s*'parent'\s*\]\)", "authorizeRoles(['director', 'vice_director', 'subdirector', 'teacher', 'parent'])", c2)
    c2 = re.sub(r"authorizeRoles\(\[\s*'admin'\s*,\s*'parent'\s*\]\)", "authorizeRoles(['director', 'vice_director', 'subdirector', 'parent'])", c2)
    if c2 != c:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c2)
        print('updated', path)
print('done')
