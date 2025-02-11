<#
var rectem_data = (rectem_data || []).concat([
({
    id: "",
    tags: "",
    content: {},
    parentId: "",
    relatedItems: [],
})
])
#>

param (
    [string] $Path = ".",
    [string] $CombineHead = "var rectem_data = (rectem_data || []).concat([`n",
    [string] $CombineDelimiter = ",`n",
    [string] $CombineFoot = "]);",
    [string] $CombinedFilename = "data.js"
)

Push-Location

Set-Location $Path

$dirs = Get-Item * | ? { $_.GetType().Name -eq "DirectoryInfo" }

$combined = $CombineHead
$count_combined = 0

$dirs | % {
    $dir = $_
    $files = Get-Item "$($dir.name)/*.js"
    $count = 0
    $files | % {
        $file_content = Get-Content $_ -Raw
        if ($file_content -match "^\(\{") {
            $combined += $file_content + $CombineDelimiter
            $count ++
        } else {
            Write-Host "ignoring file $($_.name)"
        }
    }
    Write-Host "$($dir.name): $count"
    $count_combined += $count
}

$combined += $CombineFoot

$combined | Set-Content $CombinedFilename

Write-Host "Combined $($count_combined) files into $($CombinedFilename)"

Pop-Location
