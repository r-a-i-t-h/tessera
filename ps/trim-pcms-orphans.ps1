# Identify orphans

if (-not (test-path ./orphans)) {
    New-Item ./orphans -ItemType Directory
}

$files = (Get-ChildItem *.xml).name

$active_content_files = ([xml](Get-Content "../web_structure.config")).selectnodes("//Content").guid | % { "$_.xml" }

$orphans = $files | ? { $active_content_files -notcontains $_ }

Move-Item -path $orphans -Destination ./orphans
