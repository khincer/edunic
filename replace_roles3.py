import re, glob, os

for p in glob.glob('apps/edunic-api/src/routes/*.ts'):
    with open(p, encoding='utf-8') as f:
        c = f.read()
    orig = c
    c = re.sub(r"authorizeRoles\(\[\s*'admin'\s*,\s*'teacher'\s*,\s*'parent'\s*\]\)", 
               "authorizeRoles(['director', 'vice_director', 'subdirector', 'teacher', 'parent'])", c)
    if c != orig:
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(p)
print('done')
