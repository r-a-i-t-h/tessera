# Trim all content files

$ff = (Get-ChildItem *.xml).Name
$ff | % {
    Write-Host "Processing $_"

    [xml] $x = Get-Content $_

    $vers = $x.content.status.selectnodes("*").version
    $rm = $x.content.versions.version | ? { $vers -notcontains $_.id }
    if ($rm) {
        Write-Host "    removing $($rm.count) versions"
        $rm | % { $z = $_.parentnode.removechild($_) }
        Write-Host "    $($x.content.versions.version.count) versions remain"
    }

    $rm = $x.content.history.action
    if ($rm) {
        Write-Host "    removing $($rm.count) actions"
        $rm | % { $z = $_.parentnode.removechild($_) }
    }

    Write-Host "    saving to $_"
    $x.save("$pwd/$_") # Note: xml doc saves to system cwd rather than pwsh cwd - ensure to use absolute path!
}
