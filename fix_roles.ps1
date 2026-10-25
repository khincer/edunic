$files = Get-ChildItem -Path "apps/edunic-api/src/routes" -Filter *.ts
foreach($f in $files){
    $c = Get-Content $f.FullName -Raw
    $c2 = $c -replace "authorizeRoles\(\[\s*'admin'\s*,\s*'teacher'\s*,\s*'parent'\s*\]\)", "authorizeRoles(['director', 'vice_director', 'subdirector', 'teacher', 'parent'])"
    if($c2 -ne $c){
        Set-Content $f.FullName -Value $c2 -NoNewline
        Write-Host "upd"
    }
}
Write-Host "done"
