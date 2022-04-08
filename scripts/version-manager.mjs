import { getPackageInfos, getPackageGraph, getInternalDeps, getBranchName } from 'workspace-tools'

$.verbose = false

const isPublish = process.argv.includes('--publish')

const packages = getPackageInfos('.')

const isDepsFree = (pkg, packages, resolved) => {
  const deps = getInternalDeps(pkg, packages)
  return deps.filter(dep => !resolved.has(dep)).length === 0
}

const resolved = new Set()
while (resolved.size !== Object.values(packages).length) {
  for (const pkg of Object.values(packages)) {
    if (isDepsFree(pkg, packages, resolved)) {
      resolved.add(pkg.name)
    }
  }
}

const getPublishedVersion = async (pkg) => {
  try {
    const result = await $`npm info ${pkg} version`
    return result.stdout.toString().trimEnd()
  } catch (e) {
    const notFound = e.stderr.toString().includes('code E404')
    if (notFound) {
      return null
    } else {
      throw e
    }
  }
}

const publishedVersion = Object.fromEntries(await Promise.all(Array.from(resolved).map(async pkg => {
  return [pkg, await getPublishedVersion(pkg)]
})))

$.verbose = true
if (isPublish) {
  const branch = getBranchName('.')
  if (branch !== 'main') {
    console.log('Error: bump should be executed in main branch')
    process.exit(1)
  }

  // Ensure all changes are committed
  await $`git diff`

  $`npm run clean`
  $`npm run build`
} else {
  console.log(`Publish plan:`)
}

for (const pkgName of resolved) {
  const pkg = packages[pkgName]
  if (publishedVersion[pkg.name] === pkg.version) continue

  if (isPublish) {
    $`npm publish -w ${pkgName}`
  } else {
    console.log(`  ${pkg.name}: ${publishedVersion[pkg.name]} -> ${pkg.version}`)
  }
}
