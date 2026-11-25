import os

from selenium.webdriver.common.by import By
from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))
case01_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case-01.html")
)

# legacy selector replacement:
root = '//*[@html2pdf]';
test_aside = '//*[@data-testid="ignored"]';
page_num_total = '//span[@html2pdf-page-number-total]';
# scoped legacy selector replacement (the 2nd one has legacy prefix):
full_path_header_page_num_total = '//html2pdf4doc-header//span[@html2pdf-page-number-total]';
full_path_footer_page_num_total = '//html2pdf4doc-footer//span[@html2pdf-page-number-total]';

class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    def test_01(self):
        self.helper.open_case(path_to_this_test_file_folder, '001')
        # data-preloader-target='' solved by _resolveTarget(customConfig)
        self.helper.assert_document_has_pages(1)

        # TODO check config option names and warnings from fallback:
        # [HTML2PDF4DOC] Config option "printWidth" is deprecated. Use "paperWidth" instead.
        # [HTML2PDF4DOC] Config option "printHeight" is deprecated. Use "paperHeight" instead.

    def test_02(self):
        self.helper.open_case(path_to_this_test_file_folder, 'legacy_selector_prefix')
        self.helper.assert_document_has_pages(3)
        self.helper.assert_element_has_attribute(root, 'html2pdf4doc-print-ignore');
        self.helper.assert_element_has_attribute(test_aside, 'html2pdf4doc-print-hide');
        # Testing includes scoped legacy selector replacement:
        self.helper.assert_element_has_text(full_path_header_page_num_total, '3');
        self.helper.assert_element_has_text(full_path_footer_page_num_total, '3');
        # Checking for styles:
        style_xpath = "//style[@html2pdf4doc-style]"
        self.assert_element_present(
            f"{style_xpath}",
            by=By.XPATH
        )
        self.assert_element_present(
            f"{style_xpath}[contains(., '[html2pdf4doc-page-number],[html2pdf-page-number]')]",
            by=By.XPATH
        )
        self.assert_element_present(
            f"{style_xpath}[contains(., 'html2pdf4doc-header [html2pdf4doc-page-number],html2pdf4doc-header [html2pdf-page-number]')]",
            by=By.XPATH
        )
        self.assert_element_present(
            f"{style_xpath}[contains(., 'html2pdf4doc-footer [html2pdf4doc-page-number],html2pdf4doc-footer [html2pdf-page-number]')]",
            by=By.XPATH
        )

    #   Length options: the print area height is
    #   the paper height (600px) minus the top and bottom (50px) margins.
    #   Before the fix, "0" became false, and a value the browser rejects
    #   kept the px value of the previous option (the right margin, 77px).

    def test_length_zero(self):
        self.helper.open_case(path_to_this_test_file_folder, 'length_zero')
        self.helper.assert_html2pdf4doc_success()
        assert self.helper.get_print_area_height() == 550

    def test_length_unitless(self):
        # A unitless number is read as px.
        self.helper.open_case(path_to_this_test_file_folder, 'length_unitless')
        self.helper.assert_html2pdf4doc_success()
        assert self.helper.get_print_area_height() == 520

    def test_length_invalid(self):
        # An invalid length falls back to the default top margin (12mm, 45px).
        self.helper.open_case(path_to_this_test_file_folder, 'length_invalid')
        self.helper.assert_html2pdf4doc_success()
        assert self.helper.get_print_area_height() == 505
