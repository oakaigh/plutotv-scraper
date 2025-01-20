import {v4 as uuidv4} from 'uuid';

import {PlutoTVM3U8Loader, PlutoTVXMLTVLoader} from './scraper';


export class APIRouter {
    constructor() {}

    async use(request: Request): Promise<Response> {
        const url = new URL(request.url);

        switch (url.pathname) {
            case '/playlist.m3u':
            case '/playlist.m3u8':
                return new Response(
                    await new PlutoTVM3U8Loader().load(
                        {
                            headerTags: [
                                'x-tvg-url="guide.xml"',
                                'url-tvg="guide.xml"',
                            ],
                            transforms: {
                                channelURL: (url) => {
                                    // TODO
                                    const sessionID = uuidv4();
                                    for (const key of ['sessionID', 'sid'])
                                        url.searchParams.set(key, sessionID);
                                    return url;
                                }
                            },
                        }, 
                        { params: { clientID: uuidv4() } },
                    ),
                    { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } },
                );
            case '/epg.xml':
            case '/guide.xml':
                return new Response(
                    await new PlutoTVXMLTVLoader().load(
                        {},
                        { params: { clientID: uuidv4() } },
                    ), 
                    { headers: { 'Content-Type': 'application/xml' } },
                );
            default:
                return new Response(null, { status: 404 });
        }
    }
}
