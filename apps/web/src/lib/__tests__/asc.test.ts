import { describe, expect, it } from 'vitest'
import {
  ascLocaleFor,
  blocking,
  bundleDigest,
  bundleDirectory,
  bundleFileName,
  buildManifest,
  commandLine,
  preflight,
  uploadCommand,
  APP_STORE_LOCALES,
  ASC_DISPLAY_TYPE,
  type AscManifestFile,
  type AscTarget,
} from '@/lib/asc'
import { DEFAULT_GLOBALS } from '@/stores/project.store'
import type { Release, ReleaseFile } from '@/types'

/**
 * Ce qu'un lot doit prouver avant de partir.
 *
 * Trois choses, et elles sont indépendantes : le manifeste est **déterministe**
 * (deux calculs du même lot donnent le même fichier), la commande **ne
 * supprime rien** tant que personne ne l'a demandé, et le preflight **refuse
 * localement** ce qu'App Store Connect refuserait après le téléversement.
 *
 * Aucun identifiant réel ici : la destination est un identifiant de
 * localisation factice, et rien dans ce fichier ne touche au réseau.
 */

function releaseFile(over: Partial<ReleaseFile> = {}): ReleaseFile {
  return {
    path: '6.9/01_accueil.png',
    screenId: 's1',
    width: 1320,
    height: 2868,
    byteLength: 1_200_000,
    sha256: 'a'.repeat(64),
    ...over,
  }
}

function release(over: Partial<Release> = {}): Release {
  return {
    id: 'rel-1',
    name: '1.4.0',
    createdAt: 1_700_000_000_000,
    watermarked: false,
    files: [releaseFile()],
    snapshot: { name: 'Cadence', screens: [], layoutLayers: [], globals: DEFAULT_GLOBALS },
    ...over,
  }
}

const TARGET: AscTarget = {
  bundleId: 'com.exemple.cadence',
  appVersion: '1.4.0',
  locale: 'fr-FR',
  versionLocalization: 'LOC-1234',
}

function manifestFile(over: Partial<AscManifestFile> = {}): AscManifestFile {
  return {
    name: '01_accueil.png',
    sha256: 'a'.repeat(64),
    byteLength: 1_200_000,
    width: 1320,
    height: 2868,
    ...over,
  }
}

describe('langues App Store', () => {
  it('propose la langue du magasin la plus proche du code du projet', () => {
    expect(ascLocaleFor('de')).toBe('de-DE')
    expect(ascLocaleFor('de-DE')).toBe('de-DE')
    expect(ascLocaleFor('ja')).toBe('ja')
    // « en » seul est ambigu entre six variantes : le magasin en attend une.
    expect(ascLocaleFor('en')).toBe('en-US')
    expect(ascLocaleFor('kl')).toBeUndefined()
    expect(ascLocaleFor('')).toBeUndefined()
  })

  it('ne connaît que des langues qu’App Store Connect accepte', () => {
    expect(APP_STORE_LOCALES).toContain('zh-Hans')
    expect(APP_STORE_LOCALES).not.toContain('de')
    expect(new Set(APP_STORE_LOCALES).size).toBe(APP_STORE_LOCALES.length)
  })
})

describe('arborescence', () => {
  it('range le lot par langue puis par taille d’écran', () => {
    expect(bundleDirectory('fr-FR')).toBe(`fr-FR/${ASC_DISPLAY_TYPE}`)
  })

  it('aplatit le nom de fichier et n’y laisse aucun séparateur', () => {
    expect(bundleFileName(releaseFile())).toBe('01_accueil.png')
    expect(bundleFileName(releaseFile({ path: '6.9/02_Écran Pro.png' }))).toBe('02__cran_pro.png')
    expect(bundleFileName(releaseFile({ path: '../../evil.png' }))).toBe('evil.png')
  })
})

describe('empreinte du lot', () => {
  it('ne dépend pas de l’ordre de rendu', async () => {
    const files = [
      { name: '01_a.png', sha256: 'a'.repeat(64) },
      { name: '02_b.png', sha256: 'b'.repeat(64) },
    ]
    expect(await bundleDigest(files)).toBe(await bundleDigest([...files].reverse()))
  })

  it('change dès qu’une planche change', async () => {
    const before = await bundleDigest([{ name: '01_a.png', sha256: 'a'.repeat(64) }])
    const after = await bundleDigest([{ name: '01_a.png', sha256: 'c'.repeat(64) }])
    expect(before).not.toBe(after)
    expect(before).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('manifeste', () => {
  it('rend deux fois le même fichier pour le même lot', () => {
    const files = [manifestFile({ name: '02_b.png' }), manifestFile({ name: '01_a.png' })]
    const first = buildManifest(release(), TARGET, files, 'f'.repeat(64))
    const second = buildManifest(release(), TARGET, [...files].reverse(), 'f'.repeat(64))
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.files.map((file) => file.name)).toEqual(['01_a.png', '02_b.png'])
  })

  it('porte la destination et la commande, jamais un identifiant Apple', () => {
    const manifest = buildManifest(release(), TARGET, [manifestFile()], 'f'.repeat(64))
    expect(manifest.target.deviceType).toBe(ASC_DISPLAY_TYPE)
    expect(manifest.directory).toBe(`fr-FR/${ASC_DISPLAY_TYPE}`)
    expect(manifest.command).toContain('--version-localization')
    const body = JSON.stringify(manifest)
    expect(body).not.toMatch(/p8|privateKey|issuer|apiKey/i)
  })
})

describe('commande', () => {
  it('ne supprime rien tant qu’on ne l’a pas demandé', () => {
    const command = uploadCommand(TARGET, './fr-FR/APP_IPHONE_69')
    expect(command).not.toContain('--replace')
    expect(command).not.toContain('--dry-run')
    expect(command.slice(0, 3)).toEqual(['asc', 'screenshots', 'upload'])
    expect(command).toContain(ASC_DISPLAY_TYPE)
  })

  it('rend exactement les arguments que le pont exécutera', async () => {
    /* Les deux constructeurs vivent dans deux paquets — le pont ne peut pas
       importer le navigateur, et le navigateur ne doit rien recevoir du pont
       qu'un type. Rien ne les réunit donc à la compilation : c'est ce test qui
       les tient appariés. Sans lui, la commande affichée et la commande lancée
       avaient déjà divergé sur `--replace`, le seul drapeau irréversible. */
    const { uploadArgs } = await import('../../../../bridge/src/asc')
    const cas = [
      { replaceExisting: false, dryRun: false },
      { replaceExisting: true, dryRun: false },
      { replaceExisting: false, dryRun: true },
      { replaceExisting: true, dryRun: true },
    ]
    for (const options of cas) {
      const affichée = uploadCommand(TARGET, '/tmp/lot', options)
      const exécutée = uploadArgs(
        { versionLocalization: TARGET.versionLocalization, deviceType: ASC_DISPLAY_TYPE },
        { path: '/tmp/lot', ...options },
      )
      // Le premier élément de l'affichage est le binaire, que `execFile` porte
      // à part : c'est la seule différence permise entre les deux.
      expect(affichée.slice(1)).toEqual(exécutée)
    }
  })

  it('reste lisible sans jamais être exécutée telle quelle', () => {
    expect(commandLine(['asc', 'upload', '--path', './fr-FR/APP_IPHONE_69'])).toBe(
      'asc upload --path ./fr-FR/APP_IPHONE_69',
    )
    expect(commandLine(['asc', '--name', 'Mon écran'])).toBe('asc --name "Mon écran"')
  })
})

describe('preflight', () => {
  it('laisse passer un lot conforme', () => {
    expect(preflight(release(), TARGET, [manifestFile()])).toEqual([])
    expect(blocking([])).toBe(false)
  })

  it('refuse un lot filigrané, quoi qu’il contienne d’autre', () => {
    const findings = preflight(release({ watermarked: true }), TARGET, [manifestFile()])
    expect(blocking(findings)).toBe(true)
    expect(findings[0].message).toMatch(/filigrane/i)
  })

  it('refuse une langue que le magasin ne connaît pas, et dit laquelle il attend', () => {
    const findings = preflight(release(), { ...TARGET, locale: 'de' }, [manifestFile()])
    expect(blocking(findings)).toBe(true)
    expect(findings.some((finding) => finding.message.includes('de-DE'))).toBe(true)
  })

  it('refuse une destination incomplète ou mal formée', () => {
    const broken = preflight(
      release(),
      { bundleId: 'monapp', appVersion: 'quatre', locale: 'fr-FR', versionLocalization: '' },
      [manifestFile()],
    )
    expect(broken.filter((finding) => finding.level === 'error')).toHaveLength(3)
  })

  it('refuse une planche hors dimensions, et signale seulement celle qui pèse', () => {
    const findings = preflight(release(), TARGET, [
      manifestFile({ name: '01_a.png', width: 1179, height: 2556 }),
      manifestFile({ name: '02_b.png', byteLength: 9_000_000 }),
    ])
    const errors = findings.filter((finding) => finding.level === 'error')
    const warnings = findings.filter((finding) => finding.level === 'warning')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('01_a.png')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('02_b.png')
    // Un poids excessif n'a jamais empêché une publication qu'Apple accepte.
    expect(blocking(warnings)).toBe(false)
  })

  it('refuse un lot vide ou trop grand pour un jeu de captures', () => {
    expect(blocking(preflight(release(), TARGET, []))).toBe(true)
    const many = Array.from({ length: 11 }, (_, index) => manifestFile({ name: `${index}_a.png` }))
    expect(blocking(preflight(release(), TARGET, many))).toBe(true)
  })
})
