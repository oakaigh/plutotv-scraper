import {v4 as uuidv4} from 'uuid';

import {PlutoTVXSPFLoader, PlutoTVM3U8Loader, PlutoTVXMLTVLoader} from './scraper';




export class APIRouter {
    constructor() {}

    async use(request: Request): Promise<Response> {
        const url = new URL(request.url);

        switch (url.pathname) {
            case '/playlist.m3u':
            case '/playlist.m3u8':
                return new Response(
                    await new PlutoTVM3U8Loader().load({
                        headerTags: [
                            'x-tvg-url="guide.xml"',
                            'url-tvg="guide.xml"',
                        ],
                        params: {
                            clientID: uuidv4(),
                        },
                        transforms: {
                            channelURL: (url) => {
                                // TODO
                                const sessionID = uuidv4();
                                for (const key of ['sessionID', 'sid'])
                                    url.searchParams.set(key, sessionID);
                                return url;
                            }
                        },
                    }),
                    { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } },
                );
            // TODO rm?
            case '/playlist.xml':
            case '/playlist.xspf':
                return new Response(
                    await new PlutoTVXSPFLoader().load({
                        params: {
                            clientID: uuidv4(),
                        },
                        transforms: {
                            channelURL: (url) => {
                                // TODO
                                const sessionID = uuidv4();
                                for (const key of ['sessionID', 'sid'])
                                    url.searchParams.set(key, sessionID);
                                return url;
                            }
                        },
                    }),
                    //{ headers: { 'Content-Type': 'application/xspf+xml' } },
                    { headers: { 'Content-Type': 'application/xml' } },
                );
            case '/epg.xml':
            case '/guide.xml':
                // TODO
                return new Response(
                    await new PlutoTVXMLTVLoader().load(), 
                    { headers: { 'Content-Type': 'application/xml' } },
                );
            default:
                return new Response(null, { status: 404 });
        }
    }

    async playlist(request: Request): Promise<Response> {
        //request.url

        return new Response(
            await new PlutoTVXSPFLoader().load({
                params: {
                    clientID: uuidv4(),
                },
                transforms: {
                    channelURL: (url) => {
                        // TODO
                        const sessionID = uuidv4();
                        for (const key of ['sessionID', 'sid'])
                            url.searchParams.set(key, sessionID);
                        return url;
                    }
                },
            }),
            //{ headers: { 'Content-Type': 'application/xspf+xml' } },
            { headers: { 'Content-Type': 'application/xml' } },
        );
    }
}
