// Vial Label Applicator Jig — 3 mL and 10 mL
// ------------------------------------------------------------
// Low tray with rounded saddles: one holds the vial's bottom (against
// the "BASE" stop wall), one holds the cap. Two tall guide fins stand
// across the tray at the label's top and bottom edges, forming a slot
// exactly one label-height wide over the vial.
//
// Why it goes on straight
//   - The fins run past both sides of the vial, so the label is held on
//     both sides of the vial and can't twist (only ~0.3 mm play).
//   - The fin tops are chamfered so the label drops into the slot.
//   - The fin positions are measured from the BASE wall, so every label
//     lands at the same height on the vial.
//
// How to use
//   1. Set the vial in the saddles, bottom pushed against the BASE wall.
//   2. Peel a label and drop it STICKY SIDE DOWN into the slot between
//      the fins, roughly centered. Press it onto the top of the vial.
//   3. Roll the vial by the cap. The fins keep both label edges square
//      while it wraps.
//
// Render one size with:  openscad -D 'size="3ml"'  -o labeler_3ml.stl  vial_labeler.scad
//                        openscad -D 'size="10ml"' -o labeler_10ml.stl vial_labeler.scad
//
// MEASURE YOUR VIALS AND LABELS with calipers and edit the numbers below.
// Vial dimensions vary by manufacturer; the defaults are common sizes.
// Print as oriented (flat side down), 0.2 mm layers, no supports.
// ------------------------------------------------------------

size = "both";            // "3ml", "10ml", or "both"

// ---------- 3 mL vial + label ----------
v3_len      = 38;    // overall vial length incl. cap (base to top of cap)
v3_dia      = 17;    // vial body outside diameter
v3_body     = 25;    // straight body length, base to start of shoulder
v3_cap_dia  = 13.5;  // cap / crimp outside diameter
v3_cap_len  = 7;     // cap / crimp length
v3_label_w  = 44.5;  // label length (wraps around the vial)  1.75"
v3_label_h  = 19;    // label height (along the vial axis)    0.75"
v3_offset   = -1;    // label bottom edge distance from vial base; -1 = auto-center on straight body

// ---------- 10 mL vial + label ----------
v10_len     = 50;
v10_dia     = 22;
v10_body    = 33;
v10_cap_dia = 20.5;
v10_cap_len = 8;
v10_label_w = 63.5;  // 2.5"
v10_label_h = 25.4;  // 1"
v10_offset  = -1;

// ---------- Jig settings ----------
cradle_clear = 0.5;  // radial play in the saddles
tray_t       = 2.0;  // tray floor thickness
under_gap    = 2.0;  // space between vial and tray floor (label passes here)
rim_w        = 2.0;  // tray rim width
rim_h        = 1.2;  // tray rim height above the floor
wall_t       = 3.0;  // BASE stop wall thickness
wing         = 8;    // how far the fins reach past each side of the vial
size_tab     = 6;    // strip past the cap end for the size marking
fin_t        = 2.0;  // guide fin thickness
fin_above    = 4.0;  // fin height above the top of the vial
chamfer      = 1.0;  // lead-in chamfer on the fin tops (each side)
label_gap    = 0.15; // play between each label edge and its fin
mark_depth   = 0.4;  // depth of engraved markings

$fn = 96;

module labeler(vlen, vdia, vbody, cdia, clen, lw, lh, off_in, label_txt) {
    off    = off_in >= 0 ? off_in : (vbody - lh) / 2;
    r      = vdia / 2;
    R      = r + cradle_clear;               // body saddle radius
    Rc     = cdia / 2 + cradle_clear;        // cap saddle radius
    zcen   = tray_t + under_gap + R;         // saddle arc centers
    top    = zcen - cradle_clear + r;        // top of a resting vial
    fin_z  = top + fin_above;
    W      = R + wing;                       // half-width of the fins / tray
    f1     = off - label_gap - fin_t;        // first fin (base side)
    f2     = off + lh + label_gap;           // second fin (cap side)
    x0     = -wall_t - rim_w;                // tray extents
    x1     = vlen + size_tab + rim_w;

    assert(off >= 0 && off + lh <= vbody, "Label does not fit on the straight body with this offset");
    assert(f2 + fin_t < vlen - clen, "Cap saddle overlaps the label fins");

    // vial-shaped clearance cut, open to the top
    module slot(rad, xa, xb) {
        translate([xa - 1, 0, zcen]) rotate([0, 90, 0]) cylinder(r = rad, h = xb - xa + 2);
        translate([xa - 1, -rad, zcen]) cube([xb - xa + 2, 2 * rad, 100]);
    }

    difference() {
        union() {
            // tray floor + rim
            translate([x0, -W, 0]) cube([x1 - x0, 2 * W, tray_t]);
            difference() {
                translate([x0, -W, 0]) cube([x1 - x0, 2 * W, tray_t + rim_h]);
                translate([x0 + rim_w, -W + rim_w, tray_t]) cube([x1 - x0 - 2 * rim_w, 2 * W - 2 * rim_w, 10]);
            }

            // BASE stop wall + base saddle (up to the first fin)
            translate([-wall_t, -W, 0]) cube([wall_t + 0.01, 2 * W, top - r * 0.3]);
            if (f1 > 0) translate([0, -R - 4, 0]) cube([f1 + 0.01, 2 * R + 8, zcen]);

            // cap saddle
            translate([vlen - clen, -Rc - 4, 0]) cube([clen, 2 * Rc + 8, zcen]);

            // guide fins, chamfered on the label side so the label drops in
            for (i = [0, 1]) translate([i == 0 ? f1 : f2 + fin_t, -W, 0])
                mirror([i, 0, 0]) rotate([90, 0, 0]) mirror([0, 0, 1])
                    linear_extrude(2 * W)
                        polygon([[0, 0], [fin_t, 0], [fin_t, fin_z - chamfer],
                                 [fin_t - chamfer, fin_z], [0, fin_z]]);
        }

        // vial clearance through saddles and fins
        slot(R, -wall_t, vlen - clen);
        slot(Rc, vlen - clen, vlen);

        // size text past the cap end; top of the letters toward the cap
        translate([vlen + size_tab / 2, 0, tray_t - mark_depth])
            linear_extrude(1) rotate(-90)
                text(label_txt, size = 3.5, halign = "center", valign = "center");

        // "BASE" on the stop wall, same orientation
        translate([-wall_t / 2, -R - 1, top - r * 0.3 - mark_depth])
            linear_extrude(1) rotate(-90)
                text("BASE", size = 1.8, halign = "left", valign = "center");
    }
}

module jig3()  labeler(v3_len,  v3_dia,  v3_body,  v3_cap_dia,  v3_cap_len,  v3_label_w,  v3_label_h,  v3_offset,  "3mL");
module jig10() labeler(v10_len, v10_dia, v10_body, v10_cap_dia, v10_cap_len, v10_label_w, v10_label_h, v10_offset, "10mL");

if (size == "3ml")       jig3();
else if (size == "10ml") jig10();
else if (size == "both") {
    jig3();
    translate([0, 2 * (v3_dia / 2 + cradle_clear + wing) + 10, 0]) jig10();
}
