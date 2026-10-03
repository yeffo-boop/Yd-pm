// Vial Label Applicator Jig — 3 mL and 10 mL
// ------------------------------------------------------------
// The vial lies on its side in a rounded cradle, its bottom against the
// "BASE" wall. A ramp rises out of one side of the cradle; that is
// where the label goes.
//
// How to use
//   1. Peel a label and lay it STICKY SIDE UP on the ramp, inside the
//      "LABEL" outline and between the two guide rails, with its
//      leading edge at the bottom of the ramp where it meets the cradle.
//   2. Set the vial in the cradle, bottom against the BASE wall.
//   3. Press lightly on the top of the vial and roll the top TOWARD the
//      ramp (follow the arrow). The vial turns in place, picks up the
//      label's leading edge, and pulls the rest down the ramp. The rails
//      keep the label square while it feeds, so it wraps on straight.
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
v3_label_w  = 44.5;  // label length (the direction that wraps around)  1.75"
v3_label_h  = 19;    // label height (along the vial)                    0.75"
v3_offset   = -1;    // label bottom edge distance from vial base; -1 = auto-center on straight body

// ---------- 10 mL vial + label ----------
v10_len     = 50;
v10_dia     = 22;
v10_body    = 33;
v10_label_w = 63.5;  // 2.5"
v10_label_h = 25.4;  // 1"
v10_offset  = -1;

// ---------- Jig settings ----------
cradle_clear = 0.5;  // radial play between vial and cradle
end_clear    = 0.6;  // total play between vial ends and the two end walls
floor_t      = 2.0;  // material under the cradle
wall_t       = 3.0;  // end wall thickness
ledge_w      = 8.0;  // flat ledge on the open side of the cradle
ramp_angle   = 15;   // slope of the label ramp (degrees)
rail_h       = 1.2;  // height of the label guide rails
rail_w       = 1.6;  // width of the label guide rails
rail_gap     = 0.25; // play between label edge and each rail
mark_depth   = 0.4;  // depth of engraved markings

$fn = 96;

module labeler(vlen, vdia, vbody, lw, lh, off_in, label_txt) {
    off   = off_in >= 0 ? off_in : (vbody - lh) / 2;
    r     = vdia / 2;
    R     = r + cradle_clear;                 // cradle radius
    zc    = floor_t + R;                      // cradle axis height
    inner = vlen + end_clear;                 // space between end walls
    a     = ramp_angle;

    // ramp starts where it leaves the cradle tangentially
    T     = [R * sin(a), zc - R * cos(a)];    // [y, z]
    ramp  = lw + 14;                          // ramp length
    E     = [T[0] + ramp * cos(a), T[1] + ramp * sin(a)];

    // rails start far enough up the ramp to clear the vial
    rail_s0 = sqrt(2 * r * (rail_h + 0.6)) + 1;

    assert(off >= 0 && off + lh <= vlen, "Label does not fit on the vial with this offset");

    // cross-section (Y, Z) of the solid before the cradle is cut
    module section()
        polygon([[-R - ledge_w, 0], [E[0] + 3, 0], [E[0] + 3, E[1]],
                 [E[0], E[1]], T, [0, zc], [-R - ledge_w, zc]]);

    // extrude a section along X (2D x -> Y, 2D y -> Z)
    module along_x(x0, len) translate([x0, 0, 0]) rotate([90, 0, 90])
        linear_extrude(len) children();

    // place children in the ramp plane: x = along vial, y = up the ramp
    module on_ramp() translate([0, T[0], T[1]]) rotate([a, 0, 0]) children();

    difference() {
        union() {
            // cradle + ramp
            along_x(0, inner) difference() {
                section();
                translate([0, zc]) circle(R);
            }
            // end walls (solid section, vial bottom/cap butt against them)
            along_x(-wall_t, wall_t + 0.01) section();
            along_x(inner - 0.01, wall_t + 0.01) section();

            // label guide rails on the ramp
            on_ramp() for (x = [off - rail_gap - rail_w, off + lh + rail_gap])
                translate([x, rail_s0, -0.5])
                    cube([rail_w, lw + 2 - rail_s0, rail_h + 0.5]);
        }

        on_ramp() {
            // label outline (engraved border just inside the label edges)
            translate([0, 0, -mark_depth]) linear_extrude(1) difference() {
                translate([off, 0]) square([lh, lw]);
                translate([off + 0.8, 0.8]) square([lh - 1.6, lw - 1.6]);
            }
            // "LABEL" + arrow pointing down the ramp toward the vial
            translate([off + lh / 2, lw * 0.55, -mark_depth]) linear_extrude(1) {
                rotate(90) text("LABEL", size = min(lh * 0.32, 6),
                                halign = "center", valign = "center");
            }
            translate([off + lh / 2, lw * 0.18, -mark_depth]) linear_extrude(1)
                polygon([[-3, 2], [3, 2], [0, -3]]);
            // size text past the end of the label
            translate([inner / 2, lw + 7, -mark_depth]) linear_extrude(1)
                text(label_txt, size = 5, halign = "center", valign = "center");
        }

        // "BASE" on top of the base end wall's ledge side
        translate([-wall_t / 2, -R - ledge_w / 2, zc - mark_depth]) linear_extrude(1)
            rotate(90) text("BASE", size = 2.2, halign = "center", valign = "center");

        // roll-direction arrow on the ledge: push the top of the vial this way
        translate([inner / 2, -R - ledge_w / 2, zc - mark_depth]) linear_extrude(1)
            polygon([[-2.5, -3], [2.5, -3], [2.5, 0], [4.5, 0], [0, 3.5],
                     [-4.5, 0], [-2.5, 0]]);
    }
}

module jig3()  labeler(v3_len,  v3_dia,  v3_body,  v3_label_w,  v3_label_h,  v3_offset,  "3mL");
module jig10() labeler(v10_len, v10_dia, v10_body, v10_label_w, v10_label_h, v10_offset, "10mL");

if (size == "3ml")       jig3();
else if (size == "10ml") jig10();
else {
    jig3();
    translate([v3_len + end_clear + 2 * wall_t + 12, 0, 0]) jig10();
}
