export interface PlutoTVScraperConfig {
    bootURL?: string | URL,
}

export class PlutoTVScraper {
    protected _bootData?: any;

    constructor(
        protected config?: PlutoTVScraperConfig,
    ) { }

    protected async request(url: string | URL, headers?: any) {
        var _TODO_headers = {
            ...headers,
            'X-Forwarded-For': '45.50.96.71',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
        };

        const response = await fetch(url, {
            headers: _TODO_headers
        });
        if (!response.ok)
            throw new Error(await response.text());

        return response.json();
    }

    public async boot(
        params?: Partial<{
            clientID?: string,
            clientTime?: string | Date,
        }>,
        headers?: any,
    ) {
        const url = new URL(this.config?.bootURL ?? 'https://boot.pluto.tv/v4/start');

        for (const [key, value] of [
            ['appName', 'web'],
            ['appVersion', '7.9.0-a9cca6b89aea4dc0998b92a51989d2adb9a9025d'],
            ['deviceVersion', '16.2.0'],
            ['deviceModel', 'web'],
            ['deviceMake', 'Chrome'],
            ['deviceType', 'web'],
            ['clientID', params?.clientID ?? '00000000-0000-0000-0000-000000000000'],
            ['clientModelNumber', '1.0.0'],
            ['channelID', '5a4d3a00ad95e4718ae8d8db'],
            ['serverSideAds', 'true'],
            ['constraints', ''],
            ['drmCapabilities', ''],
            ['blockingMode', ''],
            ['clientTime',
                ((x: string | Date) => x instanceof Date ? x.toISOString() : x)
                    (params?.clientTime ?? new Date())
            ]
        ])
            url.searchParams.append(key, value);

        this._bootData = await this.request(url, headers);
        return this._bootData;
    }

    protected get bootData() {
        if (this._bootData == null)
            throw new Error(`Boot data unavailable, call ${this.boot} first`);
        return this._bootData;
    }

    public async channels(
        params?: Partial<{
            channelIds?: string[],
            offset?: number,
            //limit?: number,
            sort?: string,
        }>,
        headers?: any,
    ) {
        const url = new URL(
            'v2/guide/channels',
            this.bootData?.servers?.channels ?? 'https://service-channels.clusters.pluto.tv',
        );

        for (const [key, value] of [
            ['channelIds', params?.channelIds?.join(',') ?? ''],
            ['offset', params?.offset?.toString() || '0'],
            //['limit', params?.limit?.toString() || '1000'],
            ['sort', params?.sort || 'number:asc'],
        ])
            url.searchParams.append(key, value);

        return await this.request(url, {
            ...headers,
            Authorization: `Bearer ${this.bootData.sessionToken}`,
        });
    }

    public async categories(
        params?: Partial<{}>,
        headers?: any,
    ) {
        const url = new URL(
            'v2/guide/categories',
            this.bootData?.servers?.channels ?? 'https://service-channels.clusters.pluto.tv',
        );

        return await this.request(url, {
            ...headers,
            Authorization: `Bearer ${this.bootData.sessionToken}`,
        });
    }

    public async timelines(
        params?: Partial<{
            duration?: number,
            channelIds?: string[],
            start?: string | Date,
            offset?: number,
        }>,
        headers?: any,
    ) {
        const url = new URL(
            'v2/guide/timelines',
            this.bootData?.servers?.channels ?? 'https://service-channels.clusters.pluto.tv',
        );

        if (params?.start)
            url.searchParams.append(
                'start',
                params.start instanceof Date
                    ? params.start.toISOString()
                    : params.start,
            );

        for (const [key, value] of [
            ['duration', params?.duration?.toString() ?? '240'],
            ['channelIds', params?.channelIds?.join(',') ?? ''],
            ['offset', params?.offset?.toString() ?? '0'],
        ])
            url.searchParams.append(key, value);

        return await this.request(url, {
            ...headers,
            Authorization: `Bearer ${this.bootData.sessionToken}`,
        });
    }

    public async timelinesAll(
        params?: Partial<{
            duration?: number,
            channelIds?: string[],
            start?: string | Date,
        }>,
        headers?: any,
    ) {
        const res = {
            data: [],
            meta: {
                endDateTime: null,
                totalCount: null,
                dataCount: null,
            },
        };

        for (var offset = 0; ;) {
            const timelines: any = await this.timelines({ ...params, offset }, headers);

            (res.data as any[]).push(...timelines.data);
            res.meta.endDateTime = timelines.meta.endDateTime;
            res.meta.totalCount = timelines.meta.totalCount;
            res.meta.dataCount = timelines.meta.dataCount + offset;

            offset += timelines.meta.dataCount;
            if (offset >= timelines.meta.totalCount)
                break;
        }

        return res;
    }
}


export class PlutoTVM3U8Loader {
    protected scraper: PlutoTVScraper;

    constructor() {
        this.scraper = new PlutoTVScraper();
    }

    public async load(
        options?: {
            headerTags?: string[],
            itemTags?: string[],
            transforms?: {
                channelURL?: (url: URL) => URL,
            },
        },
        requestOptions?: {
            params?: Partial<{
                clientID?: string,
                clientTime?: string | Date,
            }>,
            headers?: any,            
        },
    ) {
        // TODO
        const bootData = await this.scraper.boot({
            clientID: requestOptions?.params?.clientID,
            clientTime: requestOptions?.params?.clientTime,
        }, requestOptions?.headers);

        const [
            channelsData,
            categoriesData,
        ] = await Promise.all([
            this.scraper.channels({}, requestOptions?.headers),
            this.scraper.categories({}, requestOptions?.headers),
        ]);

        const channelGroupTitles = new Map<string, string>();
        for (const categoryData of categoriesData.data) {
            for (const channelID of categoryData.channelIDs) {
                channelGroupTitles.set(channelID, categoryData.name);
            }
        }

        const m3u8: string[] = [
            ['#EXTM3U', ...options?.headerTags ?? []].join(' '),
        ];

        // TODO
        for (const channelData of channelsData.data) {
            // channelData.isStitched
            var channelURL: URL = new URL(channelData.stitched.path, bootData.servers.stitcher);
            for (const [key, value] of new URLSearchParams(bootData.stitcherParams).entries())
                channelURL.searchParams.append(key, value);

            channelURL = options?.transforms?.channelURL?.(channelURL) ?? channelURL;

            const itemTags = [
                ...options?.itemTags ?? [],
                `tvg-id="${channelData.id}"`,
                `tvg-name="${channelData.name}"`,
            ];
            if (channelGroupTitles.get(channelData.id) != null)
                itemTags.push(`group-title="${channelGroupTitles.get(channelData.id)}"`);
            m3u8.push(
                `#EXTINF:-1 ${itemTags.join(' ')},${channelData.name}`,
                channelURL.toString(),
            );
        }

        return m3u8.join('\n');
    }
}


import { 
    Builder as XMLBuilder, 
    BuilderOptions as XMLBuilderOptions,
} from 'xml2js';


function serializeXMLTVDate(date: Date): string {
    const zeroPad = (
        num: number | string,
        maxLength: number,
    ) => String(num).padStart(maxLength, '0');

    const year = zeroPad(date.getUTCFullYear(), 4);
    const month = zeroPad(date.getUTCMonth() + 1, 2);
    const day = zeroPad(date.getUTCDate(), 2);

    const hours = zeroPad(date.getUTCHours(), 2);
    const minutes = zeroPad(date.getUTCMinutes(), 2);
    const seconds = zeroPad(date.getUTCSeconds(), 2);

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}


export class PlutoTVXMLTVLoader {
    protected scraper: PlutoTVScraper;

    constructor() {
        this.scraper = new PlutoTVScraper();
    }

    public async load(
        options?: {
            headerTags?: string[],
            itemTags?: string[],
            transforms?: {
                channelURL?: (url: URL) => URL,
            },
        },
        requestOptions?: {
            params?: Partial<{
                clientID?: string,
                clientTime?: string | Date,
            }>,
            headers?: any,            
        },
    ) {
        // TODO
        await this.scraper.boot({
            clientID: requestOptions?.params?.clientID,
            clientTime: requestOptions?.params?.clientTime,
        }, requestOptions?.headers);
        
        const [
            channelsData,
            timelinesData,
        ] = await Promise.all([
            this.scraper.channels({}, requestOptions?.headers),
            this.scraper.timelinesAll({}, requestOptions?.headers),
        ]);

        const xmlOptions: XMLBuilderOptions = {
            doctype: {'sysID': 'xmltv.dtd'},
            rootName: 'tv',
        };
        const xml: { [key: string]: any } = {
            'channel': [],
            'programme': [],
        };

        for (const channelData of channelsData.data) {
            xml['channel'].push({
                $: { id: channelData.id },
                'display-name': channelData.name,
                'icon': [...channelData.images].map(
                    (x: any) => ({
                        $: { 
                            src: new URL(x.url).toString(),
                            width: x.defaultWidth,
                            height: x.defaultHeight,
                            // TODO
                            //type: x.type,
                        },
                    })
                ),
            });
        }

        for (const channelTimelineData of timelinesData.data as any[]) {
            for (const timeline of channelTimelineData.timelines) {
                const programme: { [key: string]: any } = {
                    $: {
                        start: serializeXMLTVDate(new Date(timeline.start)),
                        stop: serializeXMLTVDate(new Date(timeline.stop)),
                        channel: channelTimelineData.channelId,
                    },
                    'title': { _: timeline.title },
                };

                if (timeline.episode?.name != null) {
                    programme['sub-title'] = { _: timeline.episode.name };
                }

                if (timeline.episode?.description != null) {
                    programme['desc'] = [{ _: timeline.episode.description }];
                }

                if (timeline.episode?.clip?.originalReleaseDate != null) {
                    programme['date'] = { 
                        _: serializeXMLTVDate(
                            new Date(timeline.episode.clip.originalReleaseDate)
                        )
                    };
                }

                if (timeline.episode?.firstAired != null) {
                    programme['date'] = { 
                        _: serializeXMLTVDate(
                            new Date(timeline.episode.firstAired)
                        )
                    };
                }

                programme['category'] = [];

                if (timeline.episode?.genre != null) {
                    programme['category'].push({ _: timeline.episode.genre });
                }

                if (timeline.episode?.subGenre != null) {
                    programme['category'].push({ _: timeline.episode.subGenre });
                }

                if (timeline.episode?.thumbnail?.path != null) {
                    programme['icon'] = { $: { src: timeline.episode.thumbnail.path } };
                }

                if (timeline.episode?.season != null) {
                    programme['episode-num'] = { 
                        $: { system: 'xmltv_ns' }, 
                        _: `${timeline.episode.season}.${timeline.episode.number ?? ''}`,
                    };
                }

                if (timeline.episode?.rating != null) {
                    programme['rating'] = { value: timeline.episode.rating };
                }

                programme['image'] = [];

                if (timeline.episode.thumbnail?.path != null) {
                    programme['image'].push({ 
                        $: { type: 'still' }, 
                        _: timeline.episode.thumbnail.path,
                    });
                }

                if (timeline.episode.poster?.path != null) {
                    programme['image'].push({ 
                        $: { type: 'poster', orient: 'P' }, 
                        _: timeline.episode.poster.path, 
                    });
                }

                if (timeline.episode.poster16_9?.path != null) {
                    programme['image'].push({ 
                        $: { type: 'poster', orient: 'L' }, 
                        _: timeline.episode.poster16_9.path,
                    });
                }
            
                xml['programme'].push(programme);
            }
        }

        return new XMLBuilder(xmlOptions).buildObject(xml);
    }
}