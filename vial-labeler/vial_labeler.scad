// Vial Label Applicator Jig — 3 mL and 10 mL
// ------------------------------------------------------------
// How it works
//   1. Peel a label and lay it STICKY SIDE UP on the raised pad.
//      The pad is exactly the label size: line the label's edges up
//      flush with the pad edges (you can feel any overhang).
//   2. Set the vial down on the leading edge of the label, lying
//      sideways between the two end walls (bottom of vial against the
//      "BASE" wall).
//   3. Press down lightly and roll the vial across the pad. The end
//      walls keep the vial square, so the label wraps on straight, and
//      the pad's distance from the base wall sets the label height.
//
// Render one size with:  openscad -D 'size="3ml"'  -o labeler_3ml.stl  vial_labeler.scad
//                        openscad -D 'size="10ml"' -o labeler_10ml.stl vial_labeler.scad
//
// MEASURE YOUR VIALS AND LABELS with calipers and edit the numbers below.
// Vial dimensions vary by manufacturer; the defaults are common sizes.
// Print flat, as oriented, 0.2 mm layers, no supports.
// ------------------------------------------------------------

size = "both";            // "3ml", "10ml", or "both"

// ---------- 3 mL vial + label ----------
v3_len      = 38;    // overall vial length incl. cap (base to top of cap)
v3_dia      = 17;    // vial body outside diameter
v3_body     = 25;    // straight body length, base to start of shoulder
v3_label_w  = 44.5;  // label length (wraps around the vial)  1.75"
v3_label_h  = 19;    // label height (along the vial axis)    0.75"
v3_offset   = -1;    // label bottom edge distance from vial base; -1 = auto-center on straight body

// ---------- 10 mL vial + label ----------
v10_len     = 50;
v10_dia     = 22;
v10_body    = 33;
v10_label_w = 63.5;  // 2.5"
v10_label_h = 25.4;  // 1"
v10_offset  = -1;

// ---------- Jig settings ----------
end_clear   = 0.6;   // total play between vial ends and the two walls
base_t      = 2.4;   // base plate thickness
pad_h       = 1.6;   // height of the label pad above the base
wall_t      = 3.0;   // end wall thickness
gap         = 1.2;   // groove between pad and lead-in / run-out platforms
lead_in     = 14;    // flat area before the pad
run_out     = 22;    // flat area after the pad
side_margin = 6;     // extra base past the walls (for the size text)

$fn = 64;

module labeler(vlen, vdia, vbody, lw, lh, off_in, label_txt) {
    off     = off_in >= 0 ? off_in : (vbody - lh) / 2;
    inner   = vlen + end_clear;               // space between end walls
    y0      = -lead_in - gap;                 // front edge of jig
    y1      = lw + gap + run_out;             // back edge of jig
    deck    = base_t + pad_h;                 // rolling surface height
    wall_hz = deck + vdia / 2;                // walls reach the vial axis

    assert(off >= 0 && off + lh <= vlen, "Label does not fit on the vial with this offset");
    assert(lw < PI * vdia * 1.25, "Label is much longer than the vial circumference");

    difference() {
        union() {
            // base plate
            translate([-wall_t, y0, 0])
                cube([inner + 2 * wall_t, y1 - y0, base_t]);

            // base wall (vial bottom rests against this, at x = 0)
            translate([-wall_t, y0, 0])
                cube([wall_t, y1 - y0, wall_hz]);

            // cap-end wall
            translate([inner, y0, 0])
                cube([wall_t, y1 - y0, wall_hz]);

            // label pad: exactly label-sized, positioned from the base wall
            translate([off, 0, base_t - 0.01])
                cube([lh, lw, pad_h + 0.01]);

            // lead-in and run-out platforms at pad height (full width)
            translate([0, y0, base_t - 0.01])
                cube([inner, lead_in, pad_h + 0.01]);
            translate([0, lw + gap, base_t - 0.01])
                cube([inner, run_out, pad_h + 0.01]);

            // side tab for the size label
            translate([-wall_t - side_margin, y0, 0])
                cube([side_margin + 0.01, y1 - y0, base_t]);
        }

        // size text engraved on the side tab
        translate([-wall_t - side_margin / 2, (y0 + y1) / 2, base_t - 0.6])
            linear_extrude(1)
                rotate(90)
                    text(label_txt, size = min(side_margin - 1.5, 5),
                         halign = "center", valign = "center");

        // "BASE" marking on the top of the base wall
        translate([-wall_t / 2, y0 + 4, wall_hz - 0.6])
            linear_extrude(1)
                rotate(90)
                    text("BASE", size = 2.2, halign = "left", valign = "center");

        // arrow on the lead-in showing the rolling direction
        translate([inner / 2, y0 + lead_in / 2, deck - 0.6])
            linear_extrude(1)
                polygon([[-3, -3], [3, -3], [0, 3]]);
    }
}

module jig3()  labeler(v3_len,  v3_dia,  v3_body,  v3_label_w,  v3_label_h,  v3_offset,  "3mL");
module jig10() labeler(v10_len, v10_dia, v10_body, v10_label_w, v10_label_h, v10_offset, "10mL");

if (size == "3ml")       jig3();
else if (size == "10ml") jig10();
else {
    jig3();
    translate([v3_len + end_clear + 2 * wall_t + side_margin + 10, 0, 0]) jig10();
}
