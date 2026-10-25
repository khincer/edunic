import re, glob

for p in glob.glob('apps/edunic-api/src/routes/*.ts'):
    with open(p, encoding='utf-8') as f:
        c = f.read()
    c2 = c
    c2 = c2.replace("['admin', 'teacher', 'parent']", "['director', 'vice_director', 'subdirector', 'teacher', 'parent']")
    c2 = c2.replace('["admin", "teacher", "parent"]', "['director', 'vice_director', 'subdirector', 'teacher', 'parent']")
    c2 = c2.replace("['admin', 'teacher']", "['director', 'vice_director', 'subdirector', 'teacher']")
    c2 = c2.replace('["admin", "teacher"]', "['director', 'vice_director', 'subdirector', 'teacher']")
    c2 = c2.replace("['admin', 'parent']", "['director', 'vice_director', 'subdirector', 'parent']")
    c2 = c2.replace('["admin", "parent"]', "['director', 'vice_director', 'subdirector', 'parent']")
    c2 = c2.replace("['admin']", "['director', 'vice_director', 'subdirector']")
    c2 = c2.replace('["admin"]', "['director', 'vice_director', 'subdirector']")
    if c2 != c:
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c2)
        print(p)
print('done')
