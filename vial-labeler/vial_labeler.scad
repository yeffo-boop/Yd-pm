// Vial Label Applicator Jig — 3 mL and 10 mL
// ------------------------------------------------------------
// The vial lies on its side in a rounded cradle, its bottom against the
// "BASE" wall. Two guide fins stand up on either side of the vial top,
// spaced exactly one label-height apart. The label drops into the slot
// between them.
//
// How to use
//   1. Set the vial in the cradle, bottom pushed against the BASE wall.
//   2. Peel a label and lay it STICKY SIDE DOWN across the top of the
//      vial, between the two guide fins (the label's long side runs
//      across the cradle, so it will wrap around the vial as a band).
//   3. Press the label down onto the vial, then roll the vial in the
//      cradle (thumb on the label, or turn it by the cap end). The fins
//      hold the label's edges square while it wraps.
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
v3_label_h  = 19;    // label height (along the vial axis, top-to-bottom when vial stands)  0.75"
v3_offset   = -1;    // label bottom edge distance from vial base; -1 = auto-center on straight body

// ---------- 10 mL vial + label ----------
v10_len     = 50;
v10_dia     = 22;
v10_body    = 33;
v10_label_h = 25.4;  // 1"
v10_offset  = -1;

// ---------- Jig settings ----------
cradle_clear = 0.5;  // radial play between vial and cradle
floor_t      = 2.0;  // material under the cradle
wall_t       = 3.0;  // base wall thickness
ledge_w      = 14;   // width of the cradle on each side of the vial (also fin length)
fin_t        = 1.6;  // guide fin thickness
fin_above    = 3.0;  // how far the fins rise above the top of the vial
label_gap    = 0.2;  // play between each label edge and its fin
mark_depth   = 0.4;  // depth of engraved markings

$fn = 96;

module labeler(vlen, vdia, vbody, lh, off_in, label_txt) {
    off    = off_in >= 0 ? off_in : (vbody - lh) / 2;
    r      = vdia / 2;
    R      = r + cradle_clear;               // cradle radius
    zc     = floor_t + R;                    // cradle axis height (cradle walls end here)
    top    = floor_t + 2 * r;                // top of a vial resting in the cradle
    fin_z  = top + fin_above;
    W      = R + ledge_w;                    // half-width of the jig
    len    = vlen;                           // cradle supports the whole vial
    fins_x = [off - label_gap - fin_t, off + lh + label_gap];

    assert(off >= 0 && off + lh <= vlen, "Label does not fit on the vial with this offset");

    module vial_space(h) {
        translate([-1, 0, zc]) rotate([0, 90, 0]) cylinder(r = R, h = h + 2);
        translate([-1, -R, zc]) cube([h + 2, 2 * R, 100]);
    }

    difference() {
        union() {
            // cradle
            translate([0, -W, 0]) cube([len, 2 * W, zc]);
            // base wall
            translate([-wall_t, -W, 0]) cube([wall_t + 0.01, 2 * W, zc + r * 0.6]);
            // guide fins
            for (x = fins_x) translate([x, -W, 0]) cube([fin_t, 2 * W, fin_z]);
        }

        vial_space(len);

        // "LABEL" between the fins, both sides of the cradle
        for (s = [-1, 1])
            translate([off + lh / 2, s * (R + ledge_w / 2), zc - mark_depth])
                linear_extrude(1)
                    rotate(s > 0 ? 180 : 0)
                        text("LABEL", size = min(4, lh / 5.5),
                             halign = "center", valign = "center");

        // size on the cap-end ledge
        translate([(fins_x[1] + fin_t + len) / 2, -(R + ledge_w / 2), zc - mark_depth])
            linear_extrude(1)
                text(label_txt, size = min(4, (len - fins_x[1] - fin_t) / 4),
                     halign = "center", valign = "center");

        // "BASE" on top of the base wall
        translate([-wall_t / 2, -(R + ledge_w / 2), zc + r * 0.6 - mark_depth])
            linear_extrude(1)
                rotate(90) text("BASE", size = 2.2, halign = "center", valign = "center");
    }
}

module jig3()  labeler(v3_len,  v3_dia,  v3_body,  v3_label_h,  v3_offset,  "3mL");
module jig10() labeler(v10_len, v10_dia, v10_body, v10_label_h, v10_offset, "10mL");

if (size == "3ml")       jig3();
else if (size == "10ml") jig10();
else {
    jig3();
    translate([0, 2 * (v3_dia / 2 + cradle_clear + ledge_w) + 10, 0]) jig10();
}
