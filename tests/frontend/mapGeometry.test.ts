import { describe, expect, it } from "vitest";

import { fitMapToViewport } from "../../src/map/mapGeometry";

describe("fitMapToViewport", () => {
    it("fits a square map inside a wider viewport and centers it horizontally", () => {
        expect(
            fitMapToViewport(
                { width: 1000, height: 1000 },
                { width: 1200, height: 800 },
            ),
        ).toEqual({
            x: 200,
            y: 0,
            width: 800,
            height: 800,
        });
    });

    it("fits a square map inside a taller viewport and centers it vertically", () => {
        expect(
            fitMapToViewport(
                { width: 1000, height: 1000 },
                { width: 800, height: 1200 },
            ),
        ).toEqual({
            x: 0,
            y: 200,
            width: 800,
            height: 800,
        });
    });

    it("preserves Grand Rift's real non-square aspect ratio", () => {
        const rect = fitMapToViewport(
            { width: 2160, height: 2158 },
            { width: 1000, height: 1000 },
        );

        expect(rect.x).toBeCloseTo(0, 10);
        expect(rect.width).toBeCloseTo(1000, 10);
        expect(rect.height).toBeCloseTo((2158 / 2160) * 1000, 10);
        expect(rect.y).toBeCloseTo((1000 - rect.height) / 2, 10);
        expect(rect.width / rect.height).toBeCloseTo(2160 / 2158, 10);
    });

    it("returns the full viewport when source and viewport share the same aspect ratio", () => {
        expect(
            fitMapToViewport(
                { width: 1600, height: 900 },
                { width: 1280, height: 720 },
            ),
        ).toEqual({
            x: 0,
            y: 0,
            width: 1280,
            height: 720,
        });
    });

    it("preserves the same relative geometry when the viewport scales proportionally", () => {
        const small = fitMapToViewport(
            { width: 1000, height: 1000 },
            { width: 1200, height: 800 },
        );

        const large = fitMapToViewport(
            { width: 1000, height: 1000 },
            { width: 2400, height: 1600 },
        );

        expect(large.x).toBeCloseTo(small.x * 2);
        expect(large.y).toBeCloseTo(small.y * 2);
        expect(large.width).toBeCloseTo(small.width * 2);
        expect(large.height).toBeCloseTo(small.height * 2);
    });

    it("handles an arbitrary non-square source and viewport", () => {
        expect(
            fitMapToViewport(
                { width: 2000, height: 1000 },
                { width: 900, height: 700 },
            ),
        ).toEqual({
            x: 0,
            y: 125,
            width: 900,
            height: 450,
        });
    });

    it("rejects zero, negative, or non-finite dimensions", () => {
        expect(() =>
            fitMapToViewport(
                { width: 0, height: 1000 },
                { width: 1000, height: 1000 },
            ),
        ).toThrow(RangeError);

        expect(() =>
            fitMapToViewport(
                { width: 1000, height: -1 },
                { width: 1000, height: 1000 },
            ),
        ).toThrow(RangeError);

        expect(() =>
            fitMapToViewport(
                { width: 1000, height: 1000 },
                { width: Number.POSITIVE_INFINITY, height: 1000 },
            ),
        ).toThrow(RangeError);
    });
});
