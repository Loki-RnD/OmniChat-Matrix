/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { JSX } from "react";

export type IconName =
    | "spark"
    | "arrow"
    | "chart"
    | "box"
    | "file"
    | "tools"
    | "check"
    | "clock"
    | "download"
    | "copy"
    | "room"
    | "close"
    | "bolt"
    | "link"
    | "retry"
    | "lock";

/** Small original line icons, sharing the workspace's current text colour. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }): JSX.Element {
    const paths: Record<IconName, JSX.Element> = {
        spark: (
            <>
                <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z" />
                <path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z" />
            </>
        ),
        arrow: (
            <>
                <path d="M5 12h14m-6-6 6 6-6 6" />
            </>
        ),
        chart: (
            <>
                <path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4" />
            </>
        ),
        box: (
            <>
                <path d="m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4" />
            </>
        ),
        file: (
            <>
                <path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h6" />
            </>
        ),
        tools: (
            <>
                <path d="M14 6a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" />
            </>
        ),
        check: <path d="m5 12 4 4L19 6" />,
        clock: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        download: (
            <>
                <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
            </>
        ),
        copy: (
            <>
                <rect x="8" y="8" width="12" height="13" rx="2" />
                <path d="M16 8V3H3v13h5" />
            </>
        ),
        room: <path d="m9 3-3 18M18 3l-3 18M3 9h18M2 15h18" />,
        close: <path d="m6 6 12 12M6 18 18 6" />,
        bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8Z" />,
        link: (
            <>
                <path d="m10 13 4-4m-6 5-2 2a3 3 0 0 0 4 4l4-4m2-6 2-2a3 3 0 0 0-4-4l-4 4" />
            </>
        ),
        retry: (
            <>
                <path d="M3 10a9 9 0 1 1 1 8M3 4v6h6" />
            </>
        ),
        lock: (
            <>
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </>
        ),
    };
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name]}
        </svg>
    );
}
