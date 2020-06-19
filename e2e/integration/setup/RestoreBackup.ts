import { join } from 'path'
import * as dashboard from '../../commands/dashboard'
import * as restore from '../../commands/restore'
import * as helpers from '../../support/helpers'
import { SETUP_STORY_URL } from '../../support/constants'

beforeAll(async () => {
    // setup page
    await helpers.setupPage(page)
})

describe(`${SETUP_STORY_URL}-Workflow1B:CoreInit/RestoreBackup`, () => {
    beforeEach(async () => {
        await dashboard.openSetupRestoreDatabase(page)
    })

    afterEach(async () => {
        await dashboard.reset(page)
    })

    for (const method of ['fromFile', 'fromText'] as const) {
        for (const backup of [
            'db_backup_0_persona_0_profile',
            'db_backup_1_persona_0_profile',
            'db_backup_1_persona_1_profile',
            'db_backup_2_personas_0_profile',
            'db_backup_2_personas_2_profiles',
        ]) {
            it(`backup file - ${backup}`, async () => {
                await restore[method](page, join(__dirname, `../../fixtures/setup/${backup}.json`))
                switch (backup) {
                    case 'db_backup_0_persona_0_profile':
                        expect(
                            (await page.evaluate(() => location.hash)).includes('#/setup/create-persona'),
                        ).toBeTruthy()
                        break
                    case 'db_backup_1_persona_0_profile':
                        expect(
                            (await page.evaluate(() => location.hash)).includes('#/setup/connect-network'),
                        ).toBeTruthy()
                        break
                    case 'db_backup_1_persona_1_profile':
                        const personaTitle = await page.waitFor('[data-testid="persona_title"]')
                        expect(await personaTitle.evaluate((e) => e.textContent?.toLowerCase())).toBe('alice')
                        break
                    default:
                        await page.waitFor('[data-testid="persona_title"]')
                        const titles = await page.evaluate(() =>
                            Array.from(document.querySelectorAll('[data-testid="persona_title"]')).map((e) =>
                                e.textContent?.toLowerCase(),
                            ),
                        )
                        expect(titles.includes('alice')).toBeTruthy()
                        expect(titles.includes('bob')).toBeTruthy()
                        break
                }
            })
        }
    }
})

// describe(`${SETUP_STORY_URL}-Workflow1B:CoreInit/RestoreBackup`, () => {
//     beforeEach(async () => {
//         await dashboard.openSetupRestoreDatabaseAdvance(page)
//     })

//     afterEach(async () => {
//         await dashboard.reset(page)
//     })

//     for (const record of [
//         // TODO:
//         // {
//         //     title: 'advance - import success  DDAI',
//         // },
//         {
//             title: 'advance mode - import success',
//             name: 'test',
//             words: 'tongue gallery cinnamon glove chapter garage very hybrid answer olympic duty sound',
//             password: '12345678',
//         },
//         {
//             title: 'advance mode - import fail',
//             name: 'test',
//             words: 'test',
//             password: 'test',
//         },
//     ]) {
//         it(record.title, async () => {
//             await restore.fromPersona(page, record)
//             if (record.title === 'advance mode - import success') {
//                 expect((await page.evaluate(() => location.hash)).includes('#/initialize/2s')).toBeTruthy()
//             }
//         })
//     }
// })
