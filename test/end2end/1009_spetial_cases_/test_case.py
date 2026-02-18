import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))

first = '//*[@data-testid="first"]';
p = '//*[@data-testid="p"]';
h1 = '//*[@data-testid="h1"]';
last = '//*[@data-testid="last"]';

class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    @staticmethod
    def check_empty_P(helper):
        helper.assert_html2pdf4doc_success()
        helper.assert_document_has_pages(2)
        helper.assert_element_ends_page(p, 1)
        # print-forced-page-break starts the 3rd page
        helper.assert_element_on_the_page(h1, 2)

    @staticmethod
    def check_normal_P(helper):
        helper.assert_html2pdf4doc_success()
        helper.assert_document_has_pages(3)
        helper.assert_element_starts_page(p, 2)
        # print-forced-page-break starts the 3rd page
        helper.assert_element_on_the_page(h1, 3)

    # base behavior
    def test_p_empty(self):
        self.helper.open_case(path_to_this_test_file_folder, 'p_empty')
        self.check_empty_P(self.helper)

    def test_p_whitespaces(self):
        self.helper.open_case(path_to_this_test_file_folder, 'p_whitespaces')
        self.check_empty_P(self.helper)

    def test_p_comment(self):
        self.helper.open_case(path_to_this_test_file_folder, 'p_comment')
        self.check_empty_P(self.helper)

    def test_p_node(self):
        self.helper.open_case(path_to_this_test_file_folder, 'p_node')
        self.check_normal_P(self.helper)

    def test_p_text(self):
        self.helper.open_case(path_to_this_test_file_folder, 'p_text')
        self.check_normal_P(self.helper)

    def test_p_br(self):
        self.helper.open_case(path_to_this_test_file_folder, 'p_br')
        self.check_normal_P(self.helper)
