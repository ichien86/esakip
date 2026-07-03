import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Renaksi from "@/models/Renaksi";
import IndicatorAnnual from "@/models/IndicatorAnnual";

/**
 * GET /api/renaksi/summary/[tahun]
 * Mengembalikan ringkasan status capaian per-indikator untuk tahun tertentu.
 * Digunakan oleh tampilan Read-Only (non-admin) pada halaman pemilihan IKU.
 *
 * Query params (opsional):
 *   indicatorIds: comma-separated list of indicator IDs to filter
 *
 * Response:
 *   { [indicatorId]: { hasTarget, hasRealisasi, bulanTarget, bulanRealisasi,
 *                      realisasiTotal, targetTahunan, tipeTarget, capaian, label, satuan } }
 */
export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { tahun: tahunParam } = await params;
    const tahun = parseInt(tahunParam);
    if (isNaN(tahun)) {
      return NextResponse.json({ error: "Tahun tidak valid" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("indicatorIds");
    const filterIds = idsParam
      ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    // 1. Ambil semua record renaksi untuk tahun ini
    const renaksiQuery = { tahun };
    if (filterIds && filterIds.length > 0) {
      renaksiQuery.indicatorId = { $in: filterIds };
    }
    const allRenaksi = await Renaksi.find(renaksiQuery).lean();

    // 2. Ambil data indikator tahunan (untuk tipeTarget & target)
    const indicatorQuery = { tahun };
    if (filterIds && filterIds.length > 0) {
      indicatorQuery.id = { $in: filterIds };
    }
    const allIndicators = await IndicatorAnnual.find(indicatorQuery).lean();
    const indicatorMap = {};
    allIndicators.forEach((ind) => {
      indicatorMap[ind.id] = ind;
    });

    // 3. Group renaksi by indicatorId
    const grouped = {};
    for (const rec of allRenaksi) {
      const id = rec.indicatorId;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(rec);
    }

    // 4. Hitung summary per indikator
    const result = {};
    const allIds =
      filterIds && filterIds.length > 0
        ? filterIds
        : [
            ...new Set([
              ...Object.keys(grouped),
              ...Object.keys(indicatorMap),
            ]),
          ];

    for (const indId of allIds) {
      const indData = indicatorMap[indId];
      const records = grouped[indId] || [];

      const hasTarget = records.some(
        (r) =>
          r.targetBulanan !== null &&
          r.targetBulanan !== undefined &&
          r.targetBulanan > 0
      );
      const realisasiRecs = records.filter(
        (r) => r.realisasiBulanan !== null && r.realisasiBulanan !== undefined
      );
      const hasRealisasi = realisasiRecs.length > 0;

      const targetTahunan = indData ? parseFloat(indData.target) || 0 : 0;
      const tipeTarget = indData
        ? indData.tipeTarget || "Kondisi Akhir Naik"
        : "Kondisi Akhir Naik";
      const satuan = indData?.satuan || "";

      let capaian = null;
      let realisasiTotal = null;
      let label = null;

      if (hasRealisasi) {
        if (tipeTarget === "Akumulatif") {
          // Jumlahkan semua realisasi bulanan — capaian berbasis kumulatif
          realisasiTotal = realisasiRecs.reduce(
            (sum, r) => sum + (parseFloat(r.realisasiBulanan) || 0),
            0
          );
          capaian =
            targetTahunan > 0
              ? parseFloat(
                  ((realisasiTotal / targetTahunan) * 100).toFixed(1)
                )
              : null;
          label = `Tercapai ${realisasiTotal} dari ${targetTahunan} ${satuan}`;
        } else if (tipeTarget === "Kondisi Akhir Menurun") {
          // Kondisi Akhir Menurun: makin kecil makin baik — rumus dibalik
          const sorted = [...realisasiRecs].sort((a, b) => b.bulan - a.bulan);
          realisasiTotal = parseFloat(sorted[0].realisasiBulanan);
          if (realisasiTotal === 0) {
            capaian = 100;
          } else {
            capaian =
              targetTahunan > 0
                ? parseFloat(
                    ((targetTahunan / realisasiTotal) * 100).toFixed(1)
                  )
                : null;
          }
          label = `Kondisi Akhir: ${realisasiTotal} ${satuan} | Capaian: ${capaian ?? "-"}%`;
        } else {
          // Kondisi Akhir Naik — ambil realisasi bulan terakhir
          const sorted = [...realisasiRecs].sort((a, b) => b.bulan - a.bulan);
          realisasiTotal = parseFloat(sorted[0].realisasiBulanan);
          capaian =
            targetTahunan > 0
              ? parseFloat(
                  ((realisasiTotal / targetTahunan) * 100).toFixed(1)
                )
              : null;
          label = `Kondisi Akhir: ${realisasiTotal} ${satuan} | Capaian: ${capaian ?? "-"}%`;
        }
      }

      result[indId] = {
        hasTarget,
        hasRealisasi,
        bulanTarget: records.filter((r) => r.targetBulanan > 0).length,
        bulanRealisasi: realisasiRecs.length,
        realisasiTotal,
        targetTahunan,
        tipeTarget,
        capaian,
        label,
        satuan,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[renaksi/summary] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
