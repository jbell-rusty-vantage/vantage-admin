"use client";

import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { checkIcons } from "../icon-check";
import { GallerySection } from "./section";

export function IconsSection() {
  const g = copy.ui1.gallery.icons;
  const rows = checkIcons();
  const missing = rows.filter((row) => !row.Icon).length;
  return (
    <GallerySection id="icons" title={copy.ui1.gallery.sections.icons}>
      <p className="si-gallery__note" data-icons-missing={missing}>
        {missing === 0 ? g.allPresent(rows.length) : g.someMissing(missing, rows.length)}
      </p>
      <div className="si-gallery__tablewrap">
        <table className="si-gallery__table" data-table="icons">
          <thead>
            <tr>
              <th>{g.use}</th>
              <th>{g.name}</th>
              <th>{g.exportName}</th>
              <th>{g.rendered}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ use, name, exportName, Icon, substitute, SubstituteIcon }) => (
              <tr key={`${use}:${name}`} data-icon={name} data-present={Icon ? "1" : "0"}>
                <td className="si-text--sm">{use}</td>
                <td>
                  <code className="si-gallery__key">{name}</code>
                </td>
                <td>
                  <code className="si-gallery__key">{exportName}</code>
                </td>
                <td>
                  {Icon ? (
                    <Icon size={20} aria-label={name} />
                  ) : (
                    <span className="si-badge si-badge--red" data-substitute={substitute ?? ""}>
                      {g.missing}
                      {substitute && (
                        <>
                          {" · "}
                          {g.substitute(substitute)}
                          {SubstituteIcon && <SubstituteIcon size={14} aria-hidden />}
                        </>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GallerySection>
  );
}
