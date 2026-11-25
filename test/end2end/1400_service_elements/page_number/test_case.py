import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))
case_current_only_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case_current_only.html")
)
case_total_only_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case_total_only.html")
)

page_number_current = '//*[@html2pdf4doc-page-number-current]'
page_number_total = '//*[@html2pdf4doc-page-number-total]'


class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

        #   A page number template may show only the current page number
        #   or only the total. Before the fix, Paper set innerHTML on the
        #   missing element and threw "Cannot set properties of null".

    def test_current_only(self):
        self.helper.do_open(case_current_only_html_file_url)
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_has_text(f"({page_number_current})[1]", "1")
        self.helper.assert_element_has_text(f"({page_number_current})[2]", "2")

    def test_total_only(self):
        self.helper.do_open(case_total_only_html_file_url)
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_has_text(f"({page_number_total})[1]", "2")
        self.helper.assert_element_has_text(f"({page_number_total})[2]", "2")
