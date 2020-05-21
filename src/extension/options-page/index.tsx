import '../../provider.worker'
import '../../setup.ui'

import React from 'react'
import { CssBaseline, useMediaQuery, NoSsr } from '@material-ui/core'
import { ThemeProvider, makeStyles, createStyles } from '@material-ui/core/styles'

import PeopleOutlinedIcon from '@material-ui/icons/PeopleOutlined'
import CreditCardIcon from '@material-ui/icons/CreditCard'
import BookmarkBorderOutlinedIcon from '@material-ui/icons/BookmarkBorderOutlined'
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined'
import { HashRouter as Router, Route, Switch, Redirect, useHistory } from 'react-router-dom'

import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import { useI18N } from '../../utils/i18n-next-ui'
import i18nNextInstance from '../../utils/i18n-next'
import { MaskbookDarkTheme, MaskbookLightTheme } from '../../utils/theme'

import FooterLine from './DashboardComponents/FooterLine'
import Drawer from './DashboardComponents/Drawer'

import DashboardPersonasRouter from './DashboardRouters/Personas'
import DashboardWalletsRouter from './DashboardRouters/Wallets'
import DashboardContactsRouter from './DashboardRouters/Contacts'
import DashboardSettingsRouter from './DashboardRouters/Settings'
import { appearanceSettings, Appearance } from '../../components/shared-settings/settings'
import { DashboardSetupRouter, SetupStep } from './DashboardRouters/Setup'
import { DashboardBlurContextUI } from './DashboardContexts/BlurContext'
import { DashboardRoute } from './Route'
import { SSRRenderer } from '../../utils/SSRRenderer'
import { useValueRef } from '../../utils/hooks/useValueRef'

import DashboardInitializeDialog from './Initialize'
import { DialogRouter } from './DashboardDialogs/DialogBase'
import { useAsync } from 'react-use'
import Services from '../service'
import { RequestPermissionPage } from '../../components/RequestPermission/RequestPermission'

const useStyles = makeStyles((theme) =>
    createStyles({
        wrapper: {
            '--monospace': 'SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace',

            '--primary': theme.palette.primary.main,
            '--textOnPrimary': theme.palette.primary.contrastText,
            '--lightText': '#C4C4C4',
            '--background': theme.palette.type === 'dark' ? '#212121' : '#F6F9FF',
            '--container': theme.palette.type === 'dark' ? '#121212' : '#FFFFFF',
            '--drawerWidth': '250px',
            '--drawerHeader': theme.palette.type === 'dark' ? '#121212' : '#1756CA',
            '--drawerBody': theme.palette.type === 'dark' ? '#121212' : 'var(--primary)',
            '--drawerText': 'var(--textOnPrimary, #FFFFFF)',
            '--drawerBodySelected': theme.palette.type === 'dark' ? '#114097' : 'var(--textOnPrimary)',
            '--drawerTextSelected': theme.palette.type === 'dark' ? 'var(--textOnPrimary)' : 'var(--primary)',
            '--listSelectedIndicator': 'var(--primary)',

            position: 'absolute',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'var(--background)',
            display: 'grid',
            gridTemplateColumns: '1fr [content-start] 1110px [content-end] 1fr',
            gridTemplateRows: '32px [content-start] auto [content-end] 50px',
            placeItems: 'center',

            transition: 'filter 0.3s linear',
            willChange: 'filter',

            '--thumbBG': 'rgba(0,0,0,0.15)',
            '--scrollbarBG': 'rgba(15,34,0,0.05)',

            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--thumbBG) var(--scrollbarBG)',
            '& *::-webkit-scrollbar': {
                width: '8px',
            },
            '& *::-webkit-scrollbar-track': {
                borderRadius: '6px',
                background: 'var(--scrollbarBG)',
            },
            '& *::-webkit-scrollbar-thumb': {
                borderRadius: '50px',
                backgroundColor: 'var(--thumbBG)',
            },
        },
        container: {
            width: '100%',
            height: '100%',
            overflow: 'auto',
            borderRadius: '12px',
            backgroundColor: 'var(--container)',
            gridRow: 'content-start / content-end',
            gridColumn: 'content-start / content-end',

            display: 'flex',
        },
        footer: {
            gridRow: 'content-end / span 1',
            gridColumn: 'content-start / content-end',
        },
        blur: {
            filter: 'blur(3px)',
        },
    }),
)

function DashboardUI() {
    const { t } = useI18N()
    const classes = useStyles()
    const history = useHistory()

    const routers = ([
        [t('personas'), DashboardRoute.Personas, <PeopleOutlinedIcon />],
        webpackEnv.target === 'WKWebview'
            ? undefined!
            : ([t('wallets'), DashboardRoute.Wallets, <CreditCardIcon />] as const),
        [t('contacts'), DashboardRoute.Contacts, <BookmarkBorderOutlinedIcon />],
        [t('settings'), DashboardRoute.Settings, <SettingsOutlinedIcon />],
    ] as const).filter((x) => x)

    // jump to persona if needed
    const { loading } = useAsync(async () => {
        const personas = await Services.Identity.queryMyPersonas()
        if (!personas.length) history.replace(`${DashboardRoute.Setup}/${SetupStep.CreatePersona}`)
        if (personas.length !== 1) return
        const profiles = await Services.Identity.queryMyProfiles()
        if (profiles.length) return
        history.replace(
            `${DashboardRoute.Setup}/${SetupStep.ConnectNetwork}?identifier=${encodeURIComponent(
                personas[0].identifier.toText(),
            )}`,
        )
    }, [])

    return (
        <DashboardBlurContextUI>
            <div className={classes.wrapper}>
                <div className={classes.container}>
                    {loading ? null : (
                        <>
                            <Drawer routers={routers} exitDashboard={null} />
                            <Switch>
                                <Route path={DashboardRoute.Personas} component={DashboardPersonasRouter} />
                                <Route path={DashboardRoute.Wallets} component={DashboardWalletsRouter} />
                                <Route path={DashboardRoute.Contacts} component={DashboardContactsRouter} />
                                <Route path={DashboardRoute.Settings} component={DashboardSettingsRouter} />
                                <Route path={DashboardRoute.Setup} component={DashboardSetupRouter} />
                                {/* // TODO: this page should be boardless */}
                                <Route path={DashboardRoute.RequestPermission} component={RequestPermissionPage} />
                                <DialogRouter
                                    path="/initialize"
                                    component={DashboardInitializeDialog}
                                    onExit={'/'}
                                    fullscreen
                                />
                                <Redirect path="*" to={DashboardRoute.Personas} />
                            </Switch>
                        </>
                    )}
                </div>
                <footer className={classes.footer}>
                    <FooterLine />
                </footer>
            </div>
        </DashboardBlurContextUI>
    )
}

export default function Dashboard() {
    const preferDarkScheme = useMediaQuery('(prefers-color-scheme: dark)')
    const appearance = useValueRef(appearanceSettings)
    return (
        <I18nextProvider i18n={i18nNextInstance}>
            <ThemeProvider
                theme={
                    (preferDarkScheme && appearance === Appearance.default) || appearance === Appearance.dark
                        ? MaskbookDarkTheme
                        : MaskbookLightTheme
                }>
                <SnackbarProvider
                    maxSnack={30}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'center',
                    }}>
                    <NoSsr>
                        <Router>
                            <CssBaseline />
                            <DashboardUI />
                        </Router>
                    </NoSsr>
                </SnackbarProvider>
            </ThemeProvider>
        </I18nextProvider>
    )
}

SSRRenderer(<Dashboard />)
