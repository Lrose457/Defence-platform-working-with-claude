-- =============================================================================
-- Backfill countries.iso_code with ISO 3166-1 alpha-3 codes.
--
-- Only 15 rows carried an iso_code; every atlas join (hover, click-through,
-- budget shading, conflict tint) resolves via iso_code → Natural Earth
-- alpha-3, so the other ~188 countries rendered as untracked land. Codes are
-- derived from the official-style names already stored in the table.
-- Only fills NULLs — never overwrites an existing code.
-- =============================================================================

update public.countries as c
set iso_code = v.iso
from (values
  (78,  'AFG'),  -- Afghanistan, Islamic Republic of
  (119, 'ALB'),  -- Albania
  (96,  'DZA'),  -- Algeria
  (81,  'AND'),  -- Andorra, Principality of
  (159, 'AGO'),  -- Angola
  (131, 'ATG'),  -- Antigua and Barbuda
  (94,  'ARG'),  -- Argentina
  (213, 'ARM'),  -- Armenia, Republic of
  (140, 'ABW'),  -- Aruba, Kingdom of the Netherlands
  (149, 'AUT'),  -- Austria
  (120, 'AZE'),  -- Azerbaijan, Republic of
  (161, 'BHS'),  -- Bahamas, The
  (199, 'BHR'),  -- Bahrain, Kingdom of
  (203, 'BGD'),  -- Bangladesh
  (84,  'BRB'),  -- Barbados
  (65,  'BLR'),  -- Belarus, Republic of
  (143, 'BEL'),  -- Belgium
  (171, 'BLZ'),  -- Belize
  (152, 'BEN'),  -- Benin
  (85,  'BTN'),  -- Bhutan
  (132, 'BOL'),  -- Bolivia
  (69,  'BIH'),  -- Bosnia and Herzegovina
  (74,  'BWA'),  -- Botswana
  (76,  'BRA'),  -- Brazil
  (57,  'BRN'),  -- Brunei Darussalam
  (104, 'BGR'),  -- Bulgaria
  (47,  'BFA'),  -- Burkina Faso
  (196, 'BDI'),  -- Burundi
  (48,  'CPV'),  -- Cabo Verde
  (70,  'KHM'),  -- Cambodia
  (110, 'CMR'),  -- Cameroon
  (66,  'CAF'),  -- Central African Republic
  (115, 'TCD'),  -- Chad
  (157, 'CHL'),  -- Chile
  (60,  'CHN'),  -- China, People's Republic of
  (68,  'COL'),  -- Colombia
  (158, 'COM'),  -- Comoros, Union of the
  (207, 'COD'),  -- Congo, Democratic Republic of the
  (168, 'COG'),  -- Congo, Republic of
  (206, 'CRI'),  -- Costa Rica
  (165, 'CIV'),  -- Côte d'Ivoire
  (170, 'HRV'),  -- Croatia, Republic of
  (185, 'CYP'),  -- Cyprus
  (117, 'CZE'),  -- Czech Republic
  (54,  'DNK'),  -- Denmark
  (169, 'DJI'),  -- Djibouti
  (111, 'DMA'),  -- Dominica
  (105, 'DOM'),  -- Dominican Republic
  (100, 'ECU'),  -- Ecuador
  (75,  'EGY'),  -- Egypt, Arab Republic of
  (52,  'SLV'),  -- El Salvador
  (49,  'GNQ'),  -- Equatorial Guinea, Republic of
  (103, 'ERI'),  -- Eritrea, The State of
  (156, 'EST'),  -- Estonia, Republic of
  (63,  'SWZ'),  -- Eswatini, Kingdom of
  (167, 'ETH'),  -- Ethiopia, The Federal Democratic Republic of
  (188, 'FJI'),  -- Fiji, Republic of
  (58,  'FIN'),  -- Finland
  (160, 'GAB'),  -- Gabon
  (91,  'GMB'),  -- Gambia, The
  (209, 'GEO'),  -- Georgia
  (141, 'GHA'),  -- Ghana
  (153, 'GRC'),  -- Greece
  (51,  'GRD'),  -- Grenada
  (192, 'GTM'),  -- Guatemala
  (195, 'GIN'),  -- Guinea
  (178, 'GNB'),  -- Guinea-Bissau
  (183, 'GUY'),  -- Guyana
  (109, 'HTI'),  -- Haiti
  (108, 'HND'),  -- Honduras
  (99,  'HKG'),  -- Hong Kong SAR
  (147, 'HUN'),  -- Hungary
  (200, 'ISL'),  -- Iceland
  (34,  'IDN'),  -- Indonesia
  (198, 'IRN'),  -- Iran, Islamic Republic of
  (77,  'IRQ'),  -- Iraq
  (208, 'IRL'),  -- Ireland
  (73,  'JAM'),  -- Jamaica
  (95,  'JOR'),  -- Jordan
  (212, 'KAZ'),  -- Kazakhstan, Republic of
  (46,  'KEN'),  -- Kenya
  (121, 'KIR'),  -- Kiribati
  (180, 'KWT'),  -- Kuwait
  (189, 'KGZ'),  -- Kyrgyz Republic
  (174, 'LAO'),  -- Lao People's Democratic Republic
  (211, 'LVA'),  -- Latvia, Republic of
  (137, 'LBN'),  -- Lebanon
  (64,  'LSO'),  -- Lesotho, Kingdom of
  (154, 'LBR'),  -- Liberia
  (142, 'LBY'),  -- Libya
  (127, 'LIE'),  -- Liechtenstein, Principality of
  (181, 'LTU'),  -- Lithuania, Republic of
  (50,  'LUX'),  -- Luxembourg
  (114, 'MAC'),  -- Macao SAR
  (193, 'MDG'),  -- Madagascar, Republic of
  (162, 'MWI'),  -- Malawi
  (144, 'MYS'),  -- Malaysia
  (59,  'MDV'),  -- Maldives
  (191, 'MLI'),  -- Mali
  (163, 'MLT'),  -- Malta
  (106, 'MHL'),  -- Marshall Islands, Republic of the
  (93,  'MRT'),  -- Mauritania, Islamic Republic of
  (122, 'MUS'),  -- Mauritius
  (67,  'MEX'),  -- Mexico
  (79,  'FSM'),  -- Micronesia, Federated States of
  (31,  'MDA'),  -- Moldova, Republic of
  (98,  'MNG'),  -- Mongolia
  (28,  'MNE'),  -- Montenegro
  (41,  'MAR'),  -- Morocco
  (215, 'MOZ'),  -- Mozambique, Republic of
  (125, 'MMR'),  -- Myanmar
  (107, 'NAM'),  -- Namibia
  (126, 'NRU'),  -- Naoero, Republic of (Nauru)
  (123, 'NPL'),  -- Nepal
  (179, 'NLD'),  -- Netherlands, The
  (186, 'NZL'),  -- New Zealand
  (101, 'NIC'),  -- Nicaragua
  (40,  'NER'),  -- Niger
  (35,  'NGA'),  -- Nigeria
  (138, 'MKD'),  -- North Macedonia, Republic of
  (176, 'NOR'),  -- Norway
  (71,  'OMN'),  -- Oman
  (87,  'PAK'),  -- Pakistan
  (36,  'PLW'),  -- Palau, Republic of
  (155, 'PAN'),  -- Panama
  (210, 'PNG'),  -- Papua New Guinea
  (139, 'PRY'),  -- Paraguay
  (112, 'PER'),  -- Peru
  (205, 'PHL'),  -- Philippines
  (116, 'POL'),  -- Poland, Republic of (duplicate of id 21)
  (33,  'PRT'),  -- Portugal
  (146, 'PRI'),  -- Puerto Rico
  (133, 'QAT'),  -- Qatar
  (135, 'ROU'),  -- Romania
  (102, 'RUS'),  -- Russian Federation
  (166, 'RWA'),  -- Rwanda
  (204, 'WSM'),  -- Samoa
  (29,  'SMR'),  -- San Marino, Republic of
  (44,  'STP'),  -- São Tomé and Príncipe, Democratic Republic of
  (173, 'SEN'),  -- Senegal
  (202, 'SRB'),  -- Serbia, Republic of
  (43,  'SYC'),  -- Seychelles
  (32,  'SLE'),  -- Sierra Leone
  (136, 'SGP'),  -- Singapore
  (164, 'SVK'),  -- Slovak Republic
  (83,  'SVN'),  -- Slovenia, Republic of
  (42,  'SLB'),  -- Solomon Islands
  (201, 'SOM'),  -- Somalia
  (37,  'ZAF'),  -- South Africa
  (182, 'SSD'),  -- South Sudan, Republic of
  (30,  'LKA'),  -- Sri Lanka
  (214, 'KNA'),  -- St. Kitts and Nevis
  (97,  'LCA'),  -- St. Lucia
  (92,  'VCT'),  -- St. Vincent and the Grenadines
  (39,  'SDN'),  -- Sudan
  (82,  'SUR'),  -- Suriname
  (89,  'SWE'),  -- Sweden
  (172, 'CHE'),  -- Switzerland
  (55,  'SYR'),  -- Syrian Arab Republic
  (86,  'TWN'),  -- Taiwan Province of China
  (124, 'TJK'),  -- Tajikistan, Republic of
  (80,  'TZA'),  -- Tanzania, United Republic of
  (190, 'THA'),  -- Thailand
  (187, 'TLS'),  -- Timor-Leste, Democratic Republic of
  (175, 'TGO'),  -- Togo
  (129, 'TON'),  -- Tonga
  (113, 'TTO'),  -- Trinidad and Tobago
  (197, 'TUN'),  -- Tunisia
  (194, 'TKM'),  -- Turkmenistan
  (145, 'TUV'),  -- Tuvalu
  (56,  'UGA'),  -- Uganda
  (62,  'UKR'),  -- Ukraine
  (38,  'ARE'),  -- United Arab Emirates
  (90,  'URY'),  -- Uruguay
  (61,  'UZB'),  -- Uzbekistan, Republic of
  (150, 'VUT'),  -- Vanuatu
  (118, 'VEN'),  -- Venezuela, República Bolivariana de
  (148, 'VNM'),  -- Vietnam
  (151, 'PSE'),  -- West Bank and Gaza (Palestine)
  (45,  'YEM'),  -- Yemen, Republic of
  (177, 'ZMB'),  -- Zambia
  (184, 'ZWE')   -- Zimbabwe
  -- Deliberately unmapped: Euro Area (130), European Union (128),
  -- Latin America and the Caribbean (134), Sub-Saharan Africa (53),
  -- Other Advanced Economies (72) — aggregates, not countries — and
  -- Kosovo (88), which has no official ISO 3166-1 code.
) as v(id, iso)
where c.id = v.id
  and c.iso_code is null
  -- Skip codes already claimed by another row (e.g. "Poland, Republic of"
  -- id 116 duplicates id 21 "Poland" which already carries POL).
  and not exists (
    select 1 from public.countries other
    where other.iso_code = v.iso and other.id <> v.id
  );
